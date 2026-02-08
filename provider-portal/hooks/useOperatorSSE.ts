/**
 * useOperatorSSE - React hook for real-time operator dashboard events
 * Connects to SSE endpoint and maintains live call state
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SSECallEvent {
  id: string;
  eventType: string;
  callSid: string;
  providerId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CallSession {
  callSid: string;
  status: 'in_progress' | 'completed';
  direction: 'inbound' | 'outbound' | 'unknown';
  startTime: string;
  endTime?: string;
  duration?: number;
  fromNumber?: string;
  callerName?: string;
  events: SSECallEvent[];
}

export interface ActiveTransfer {
  callSid: string;
  status: 'initiated' | 'answered' | 'failed';
  callerPhone: string;
  employeeName?: string;
  employeeId?: string;
  patientName?: string;
  occurrenceDetails?: {
    occurrenceId?: string;
    scheduledAt?: string;
    time?: string;
    displayDate?: string;
  };
  callPurpose?: string;
  transferTo?: string;
  initiatedAt: string;
  answeredAt?: string;
  failedAt?: string;
  failureReason?: string;
}

export interface OperatorStats {
  activeCalls: number;
  activeTransfers: number;
  outboundCallsActive: number;
  totalEventsToday: number;
}

export interface UseOperatorSSEReturn {
  activeCalls: CallSession[];
  activeTransfers: ActiveTransfer[];
  recentEvents: SSECallEvent[];
  stats: OperatorStats;
  isConnected: boolean;
  error: string | null;
}

/**
 * Format event description for display
 */
export function formatOperatorEventDescription(eventType: string, data: Record<string, unknown>): string {
  switch (eventType) {
    case 'call_started':
      return data.fromNumber ? `Call received from ${data.fromNumber}` : 'Call received';
    case 'call_authenticated':
      return `Caller identified as ${data.employeeName || 'Staff member'}`;
    case 'authentication_failed':
      return `Authentication failed: ${data.reason || 'unknown reason'}`;
    case 'intent_detected':
      return `Intent: ${data.description || data.intent || 'unknown'}`;
    case 'shift_opened': {
      const patient = data.patientName ? ` for ${data.patientName}` : '';
      return `Shift ${data.shiftId} opened${patient}`;
    }
    case 'staff_notified':
      return `${data.staffCount || 0} staff members notified via SMS`;
    case 'transfer_initiated':
      return `Transfer initiated to ${data.transferTo || 'representative'}`;
    case 'transfer_completed':
      return data.success ? 'Transfer TwiML update completed' : 'Transfer TwiML update failed';
    case 'transfer_answered':
      return 'Transfer connected - representative answered';
    case 'transfer_failed':
      return `Transfer failed - ${data.outcome || 'representative unavailable'}`;
    case 'outbound_call_started':
      return `Outbound call to ${data.employeeName || 'staff'} (Round ${data.round || '?'})`;
    case 'outbound_call_accepted':
      return `Shift accepted by ${data.employeeName || 'staff'}`;
    case 'outbound_call_declined':
      return `Shift declined by ${data.employeeName || 'staff'}`;
    case 'outbound_call_no_answer':
      return `No answer from ${data.employeeName || 'staff'} (Round ${data.round || '?'})`;
    case 'outbound_all_rounds_exhausted':
      return `All rounds exhausted for ${data.patientName || 'shift'} (${data.totalAttempts || 0} attempts to ${data.uniqueStaffCalled || 0} staff)`;
    case 'call_ended': {
      const dur = data.duration ? ` (${formatDuration(data.duration as number)})` : '';
      return `Call ended${dur}`;
    }
    default:
      return eventType.replace(/_/g, ' ');
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function useOperatorSSE(): UseOperatorSSEReturn {
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<ActiveTransfer[]>([]);
  const [recentEvents, setRecentEvents] = useState<SSECallEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callMapRef = useRef<Map<string, CallSession>>(new Map());
  const transferMapRef = useRef<Map<string, ActiveTransfer>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);

  const processEvent = useCallback((event: SSECallEvent) => {
    const { callSid, eventType, data, timestamp } = event;

    // Update call sessions
    const callMap = callMapRef.current;
    if (!callMap.has(callSid)) {
      const isOutbound = eventType.startsWith('outbound_');
      callMap.set(callSid, {
        callSid,
        status: 'in_progress',
        direction: isOutbound ? 'outbound' : (eventType === 'call_started' ? 'inbound' : 'unknown'),
        startTime: timestamp,
        fromNumber: data.fromNumber as string || '',
        events: [],
      });
    }

    const session = callMap.get(callSid)!;
    session.events.push(event);

    // Update session based on event type
    switch (eventType) {
      case 'call_authenticated':
        session.callerName = data.employeeName as string;
        break;
      case 'call_ended': {
        // Safety net: if a transfer is active (initiated but not answered/failed),
        // don't mark the call as completed — it's still in progress via <Dial>
        const activeTransfer = transferMapRef.current.get(callSid);
        const transferStillActive = activeTransfer && activeTransfer.status === 'initiated';
        if (transferStillActive) {
          // Call is being transferred, keep it in_progress
          session.status = 'in_progress';
        } else {
          session.status = 'completed';
          session.endTime = timestamp;
          session.duration = data.duration as number;
        }
        break;
      }
      case 'outbound_call_accepted':
      case 'outbound_call_declined':
      case 'outbound_call_no_answer':
      case 'outbound_all_rounds_exhausted':
        session.status = 'completed';
        session.endTime = timestamp;
        break;
      case 'outbound_call_started':
        session.callerName = data.employeeName as string;
        break;
      case 'transfer_answered':
      case 'transfer_failed': {
        // When a transfer resolves, also update the call session status
        session.status = 'completed';
        session.endTime = timestamp;
        break;
      }
    }

    // Update transfers
    const transferMap = transferMapRef.current;
    if (eventType === 'transfer_initiated') {
      transferMap.set(callSid, {
        callSid,
        status: 'initiated',
        callerPhone: data.callerPhone as string || '',
        employeeName: data.employeeName as string,
        employeeId: data.employeeId as string,
        patientName: data.patientName as string,
        occurrenceDetails: data.occurrenceDetails as ActiveTransfer['occurrenceDetails'],
        callPurpose: data.callPurpose as string,
        transferTo: data.transferTo as string,
        initiatedAt: timestamp,
      });
    } else if (eventType === 'transfer_answered') {
      const transfer = transferMap.get(callSid);
      if (transfer) {
        transfer.status = 'answered';
        transfer.answeredAt = timestamp;
      }
    } else if (eventType === 'transfer_failed') {
      const transfer = transferMap.get(callSid);
      if (transfer) {
        transfer.status = 'failed';
        transfer.failedAt = timestamp;
        transfer.failureReason = data.outcome as string;
      }
    }

    // Update state
    const allCalls = Array.from(callMap.values()).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    setActiveCalls([...allCalls]);

    const allTransfers = Array.from(transferMap.values()).sort(
      (a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()
    );
    setActiveTransfers([...allTransfers]);

    // Keep last 100 events
    setRecentEvents(prev => {
      const updated = [event, ...prev];
      return updated.slice(0, 100);
    });
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/provider/operator-stream');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      setIsConnected(true);
      setError(null);
    });

    eventSource.addEventListener('call-event', (e: MessageEvent) => {
      try {
        const eventData: SSECallEvent = JSON.parse(e.data);
        processEvent(eventData);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
      // EventSource auto-reconnects
    };

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [processEvent]);

  const stats: OperatorStats = {
    activeCalls: activeCalls.filter(c => c.status === 'in_progress').length,
    activeTransfers: activeTransfers.filter(t => t.status === 'initiated').length,
    outboundCallsActive: activeCalls.filter(c => c.status === 'in_progress' && c.direction === 'outbound').length,
    totalEventsToday: recentEvents.length,
  };

  return {
    activeCalls,
    activeTransfers,
    recentEvents,
    stats,
    isConnected,
    error,
  };
}
