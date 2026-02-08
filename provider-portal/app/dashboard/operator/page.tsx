/**
 * Operator Dashboard Page
 * Real-time operational view for the call operator/representative
 * 
 * Three panels:
 * 1. Unfilled Shifts - Shifts not picked up after all outbound call retries
 * 2. Live Activity - Real-time call events via SSE
 * 3. Transfer Details - Active/recent transfers with caller context for phone matching
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Activity,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Wifi,
  WifiOff,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  useOperatorSSE,
  formatOperatorEventDescription,
  type ActiveTransfer,
  type CallSession,
} from '@/hooks/useOperatorSSE';

interface UnfilledShift {
  id: string;
  fields: Record<string, unknown>;
  callAttempts: Array<Record<string, unknown>>;
}

export default function OperatorDashboardPage() {
  const {
    activeCalls,
    activeTransfers,
    recentEvents,
    stats,
    isConnected,
    error: sseError,
  } = useOperatorSSE();

  const [unfilledShifts, setUnfilledShifts] = useState<UnfilledShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [transferSearch, setTransferSearch] = useState('');

  // Fetch unfilled shifts
  const fetchUnfilledShifts = useCallback(async () => {
    setIsLoadingShifts(true);
    setShiftsError(null);
    try {
      const res = await fetch('/api/provider/unfilled-shifts');
      const data = await res.json();
      if (data.success) {
        setUnfilledShifts(data.shifts);
      } else {
        setShiftsError(data.error || 'Failed to load unfilled shifts');
      }
    } catch (err) {
      setShiftsError('Failed to connect to server');
    } finally {
      setIsLoadingShifts(false);
    }
  }, []);

  useEffect(() => {
    fetchUnfilledShifts();
  }, [fetchUnfilledShifts]);

  // Auto-refresh unfilled shifts when all rounds exhausted event is received
  useEffect(() => {
    const hasExhaustedEvent = recentEvents.some(
      e => e.eventType === 'outbound_all_rounds_exhausted'
    );
    if (hasExhaustedEvent) {
      fetchUnfilledShifts();
    }
  }, [recentEvents, fetchUnfilledShifts]);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const now = Date.now();
      const time = new Date(timestamp).getTime();
      const diffMs = now - time;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);

      if (diffSecs < 60) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } catch {
      return '';
    }
  };

  // Filter transfers by phone number search
  const filteredTransfers = activeTransfers.filter(t => {
    if (!transferSearch.trim()) return true;
    const search = transferSearch.toLowerCase();
    return (
      (t.callerPhone || '').toLowerCase().includes(search) ||
      (t.employeeName || '').toLowerCase().includes(search) ||
      (t.patientName || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Operator Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time call monitoring and shift management</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isConnected
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>

        {sseError && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4 text-sm">
            {sseError}
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Phone className="w-5 h-5 text-blue-600" />}
            label="Active Calls"
            value={stats.activeCalls}
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<ArrowRightLeft className="w-5 h-5 text-purple-600" />}
            label="Active Transfers"
            value={stats.activeTransfers}
            bgColor="bg-purple-50"
          />
          <StatCard
            icon={<PhoneOutgoing className="w-5 h-5 text-orange-600" />}
            label="Outbound Active"
            value={stats.outboundCallsActive}
            bgColor="bg-orange-50"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            label="Unfilled Shifts"
            value={unfilledShifts.length}
            bgColor="bg-red-50"
            highlight={unfilledShifts.length > 0}
          />
        </div>

        {/* Main Content - 2 column layout on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Panel 3: Transfer Details */}
            <TransferDetailsPanel
              transfers={filteredTransfers}
              searchValue={transferSearch}
              onSearchChange={setTransferSearch}
              formatTime={formatTime}
              formatRelativeTime={formatRelativeTime}
            />

            {/* Panel 2: Live Activity */}
            <LiveActivityPanel
              calls={activeCalls}
              formatTime={formatTime}
              formatRelativeTime={formatRelativeTime}
            />
          </div>

          {/* Right Column */}
          <div>
            {/* Panel 1: Unfilled Shifts */}
            <UnfilledShiftsPanel
              shifts={unfilledShifts}
              isLoading={isLoadingShifts}
              error={shiftsError}
              expandedShift={expandedShift}
              onToggleExpand={(id) => setExpandedShift(expandedShift === id ? null : id)}
              onRefresh={fetchUnfilledShifts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function StatCard({
  icon,
  label,
  value,
  bgColor,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${highlight ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${bgColor}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function TransferDetailsPanel({
  transfers,
  searchValue,
  onSearchChange,
  formatTime,
  formatRelativeTime,
}: {
  transfers: ActiveTransfer[];
  searchValue: string;
  onSearchChange: (val: string) => void;
  formatTime: (ts: string) => string;
  formatRelativeTime: (ts: string) => string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PhoneIncoming className="w-5 h-5 text-purple-600" />
            Transfer Details
          </h2>
          <span className="text-xs text-gray-500">{transfers.length} transfers</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by phone number, name, or patient..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto">
        {transfers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No active or recent transfers
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <div
                key={transfer.callSid}
                className={`border rounded-lg p-4 ${
                  transfer.status === 'initiated'
                    ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200'
                    : transfer.status === 'answered'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <TransferStatusBadge status={transfer.status} />
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(transfer.initiatedAt)}
                  </span>
                </div>

                {/* Caller Phone - PROMINENT for operator matching */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Caller Phone (Match on your phone)</p>
                  <p className="text-2xl font-bold text-gray-900 tracking-wide font-mono">
                    {transfer.callerPhone || 'Unknown'}
                  </p>
                </div>

                {/* Context Details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {transfer.employeeName && (
                    <div>
                      <span className="text-gray-500">Employee:</span>
                      <span className="ml-1 font-medium text-gray-900">{transfer.employeeName}</span>
                    </div>
                  )}
                  {transfer.patientName && (
                    <div>
                      <span className="text-gray-500">Patient:</span>
                      <span className="ml-1 font-medium text-gray-900">{transfer.patientName}</span>
                    </div>
                  )}
                  {transfer.occurrenceDetails?.displayDate && (
                    <div>
                      <span className="text-gray-500">Shift Date:</span>
                      <span className="ml-1 font-medium text-gray-900">{transfer.occurrenceDetails.displayDate}</span>
                    </div>
                  )}
                  {transfer.occurrenceDetails?.time && (
                    <div>
                      <span className="text-gray-500">Shift Time:</span>
                      <span className="ml-1 font-medium text-gray-900">{transfer.occurrenceDetails.time}</span>
                    </div>
                  )}
                  {transfer.callPurpose && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Purpose:</span>
                      <span className="ml-1 font-medium text-gray-900">{transfer.callPurpose}</span>
                    </div>
                  )}
                  {transfer.transferTo && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Transfer To:</span>
                      <span className="ml-1 font-medium text-gray-900 font-mono">{transfer.transferTo}</span>
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                  <span>Initiated: {formatTime(transfer.initiatedAt)}</span>
                  {transfer.answeredAt && (
                    <span className="ml-3">Answered: {formatTime(transfer.answeredAt)}</span>
                  )}
                  {transfer.failedAt && (
                    <span className="ml-3">Failed: {formatTime(transfer.failedAt)} ({transfer.failureReason})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferStatusBadge({ status }: { status: ActiveTransfer['status'] }) {
  switch (status) {
    case 'initiated':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          RINGING
        </span>
      );
    case 'answered':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
          <CheckCircle className="w-3 h-3" />
          CONNECTED
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-full">
          <XCircle className="w-3 h-3" />
          FAILED
        </span>
      );
  }
}

function LiveActivityPanel({
  calls,
  formatTime,
  formatRelativeTime,
}: {
  calls: CallSession[];
  formatTime: (ts: string) => string;
  formatRelativeTime: (ts: string) => string;
}) {
  // Show the most recent 20 calls
  const displayCalls = calls.slice(0, 20);
  const inProgressCalls = calls.filter(c => c.status === 'in_progress');
  const completedCalls = displayCalls.filter(c => c.status === 'completed');

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-600" />
          Live Activity
          {inProgressCalls.length > 0 && (
            <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
              {inProgressCalls.length} active
            </span>
          )}
        </h2>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto">
        {displayCalls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No call activity yet. Events will appear here in real-time.
          </div>
        ) : (
          <div className="space-y-3">
            {/* In-progress calls first */}
            {inProgressCalls.map((call) => (
              <CallCard
                key={call.callSid}
                call={call}
                formatTime={formatTime}
                formatRelativeTime={formatRelativeTime}
              />
            ))}
            {/* Then completed calls */}
            {completedCalls.map((call) => (
              <CallCard
                key={call.callSid}
                call={call}
                formatTime={formatTime}
                formatRelativeTime={formatRelativeTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CallCard({
  call,
  formatTime,
  formatRelativeTime,
}: {
  call: CallSession;
  formatTime: (ts: string) => string;
  formatRelativeTime: (ts: string) => string;
}) {
  const [isExpanded, setIsExpanded] = useState(call.status === 'in_progress');

  const directionIcon = call.direction === 'outbound' 
    ? <PhoneOutgoing className="w-4 h-4" />
    : <PhoneIncoming className="w-4 h-4" />;

  return (
    <div
      className={`border rounded-lg ${
        call.status === 'in_progress'
          ? 'border-green-300 bg-green-50'
          : 'border-gray-200'
      }`}
    >
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {call.status === 'in_progress' ? (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full whitespace-nowrap">
              DONE
            </span>
          )}
          <span className="text-gray-500">{directionIcon}</span>
          <span className="text-sm font-medium text-gray-900 truncate">
            {call.callerName || call.fromNumber || 'Unknown'}
          </span>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formatTime(call.startTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{formatRelativeTime(call.startTime)}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {isExpanded && call.events.length > 0 && (
        <div className="px-3 pb-3">
          <div className="space-y-1.5 pl-3 border-l-2 border-gray-300">
            {call.events.map((event, idx) => (
              <div key={idx} className="relative text-xs">
                <div className="absolute -left-[11px] w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
                <span className="text-gray-400 font-mono">{formatTime(event.timestamp)}</span>
                <span className="mx-1.5 text-gray-300">|</span>
                <span className="text-gray-700">
                  {formatOperatorEventDescription(event.eventType, event.data)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UnfilledShiftsPanel({
  shifts,
  isLoading,
  error,
  expandedShift,
  onToggleExpand,
  onRefresh,
}: {
  shifts: UnfilledShift[];
  isLoading: boolean;
  error: string | null;
  expandedShift: string | null;
  onToggleExpand: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Unfilled Shifts
          {shifts.length > 0 && (
            <span className="ml-2 bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              {shifts.length}
            </span>
          )}
        </h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="p-4 max-h-[700px] overflow-y-auto">
        {error && (
          <div className="text-center py-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {isLoading && shifts.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Loading unfilled shifts...
          </div>
        )}

        {!isLoading && !error && shifts.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No unfilled shifts. All shifts have been covered.
          </div>
        )}

        {shifts.length > 0 && (
          <div className="space-y-3">
            {shifts.map((shift) => {
              const isExpanded = expandedShift === shift.id;
              const patientName = shift.fields['Patient TXT'] as string || 'Unknown Patient';
              const scheduledAt = shift.fields['Scheduled At'] as string || '';
              const time = shift.fields['Time'] as string || '';
              const rescheduleReason = shift.fields['Reschedule Reason'] as string || '';
              const occurrenceId = shift.fields['Occurrence ID'] as string || shift.id;

              return (
                <div
                  key={shift.id}
                  className="border border-red-200 rounded-lg bg-red-50"
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => onToggleExpand(shift.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{patientName}</p>
                          <p className="text-xs text-gray-600">
                            {scheduledAt && <span>{scheduledAt}</span>}
                            {time && <span className="ml-2">at {time}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {shift.callAttempts.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {shift.callAttempts.length} calls made
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-red-200">
                      {/* Occurrence Details */}
                      <div className="mt-3 mb-3">
                        <p className="text-xs text-gray-500 mb-1">Occurrence ID</p>
                        <p className="text-sm font-mono text-gray-700">{occurrenceId}</p>
                      </div>

                      {rescheduleReason && (
                        <div className="mb-3 p-2 bg-white border border-red-100 rounded text-sm text-gray-700">
                          <p className="text-xs text-gray-500 mb-1 font-medium">Reason</p>
                          {rescheduleReason}
                        </div>
                      )}

                      {/* Call Attempt History */}
                      {shift.callAttempts.length > 0 ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">
                            Call Attempts ({shift.callAttempts.length})
                          </p>
                          <div className="space-y-2">
                            {shift.callAttempts.map((attempt, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded text-sm"
                              >
                                <CallOutcomeIcon outcome={attempt['Call Outcome'] as string} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 truncate">
                                      Round {String(attempt['Attempt Round'] ?? '?')}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                      getOutcomeColor(attempt['Call Outcome'] as string)
                                    }`}>
                                      {String(attempt['Call Outcome'] ?? 'Unknown')}
                                    </span>
                                  </div>
                                  {attempt['Started At'] ? (
                                    <p className="text-xs text-gray-500">{String(attempt['Started At'])}</p>
                                  ) : null}
                                  {attempt['Notes'] ? (
                                    <p className="text-xs text-gray-600 mt-0.5">{String(attempt['Notes'])}</p>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No call attempt data available</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CallOutcomeIcon({ outcome }: { outcome: string }) {
  switch (outcome) {
    case 'Accepted':
      return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    case 'Declined':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'No Answer':
      return <Clock className="w-4 h-4 text-yellow-500 shrink-0" />;
    default:
      return <Phone className="w-4 h-4 text-gray-400 shrink-0" />;
  }
}

function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case 'Accepted':
      return 'bg-green-100 text-green-800';
    case 'Declined':
      return 'bg-red-100 text-red-800';
    case 'No Answer':
      return 'bg-yellow-100 text-yellow-800';
    case 'Busy':
      return 'bg-orange-100 text-orange-800';
    case 'Failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
