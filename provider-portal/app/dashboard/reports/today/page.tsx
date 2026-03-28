/**
 * Today's Live Call Log Page
 * Real-time view of call activity happening today
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Phone, Activity } from 'lucide-react';
import useSWR from 'swr';

interface CallEvent {
  timestamp: string;
  type: string;
  description: string;
}

interface CallSession {
  callSid: string;
  status: 'in_progress' | 'completed';
  startTime: string;
  endTime?: string;
  duration?: number;
  fromNumber?: string;
  callerName?: string;
  events: CallEvent[];
}

interface LiveCallLogData {
  calls: CallSession[];
  totalCalls: number;
  inProgressCalls: number;
  lastUpdated: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TIME_RANGES = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: '24h', label: '24 hours' },
];

export default function TodayLiveCallLogPage() {
  const [timeRange, setTimeRange] = useState('30m');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch data with SWR (auto-refresh every 30 seconds if enabled)
  const { data, error, mutate, isLoading } = useSWR<LiveCallLogData>(
    `/api/provider/live-call-log?timeRange=${timeRange}`,
    fetcher,
    {
      refreshInterval: autoRefresh ? 30000 : 0, // 30 seconds
      revalidateOnFocus: true,
    }
  );

  const handleRefresh = () => {
    mutate();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diffMs = now - time;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/reports"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Reports</span>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Live Call Log</h1>
              <p className="text-muted-foreground mt-1">
                Real-time view of today's call activity
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-input"
                />
                Auto-refresh (30s)
              </label>

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground/80 bg-card border border-input rounded-lg hover:bg-muted/30 transition-colors shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="bg-card border border-input rounded-lg p-4 mb-6">
          <label className="block text-sm font-medium text-foreground/80 mb-2">
            Time Range
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === range.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground/80 hover:bg-muted'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-input rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold text-foreground">{data.totalCalls}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-input rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-foreground">{data.inProgressCalls}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-input rounded-lg p-6">
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatRelativeTime(data.lastUpdated)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Call Log */}
        <div className="bg-card border border-input rounded-lg overflow-hidden">
          <div className="p-6 border-b border-border/60">
            <h2 className="text-xl font-bold text-foreground">
              Call Activity {data && `(${data.totalCalls} ${data.totalCalls === 1 ? 'call' : 'calls'})`}
            </h2>
          </div>

          <div className="p-6">
            {error && (
              <div className="text-center py-8 text-destructive">
                Failed to load call log. Please try again.
              </div>
            )}

            {isLoading && !data && (
              <div className="text-center py-8 text-muted-foreground">
                Loading call log...
              </div>
            )}

            {data && data.calls.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No calls in the selected time range.
              </div>
            )}

            {data && data.calls.length > 0 && (
              <div className="space-y-6">
                {data.calls.map((call) => (
                  <div
                    key={call.callSid}
                    className={`border rounded-lg p-4 ${
                      call.status === 'in_progress'
                        ? 'border-green-300 bg-green-50'
                        : 'border-border/60'
                    }`}
                  >
                    {/* Call Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {call.status === 'in_progress' && (
                          <span className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            IN PROGRESS
                          </span>
                        )}
                        {call.status === 'completed' && (
                          <span className="px-3 py-1 bg-muted text-foreground/80 text-xs font-semibold rounded-full">
                            COMPLETED
                          </span>
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {formatTime(call.startTime)}
                          {call.endTime && ` - ${formatTime(call.endTime)}`}
                          {call.duration && ` (${Math.floor(call.duration / 60)}m ${call.duration % 60}s)`}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(call.startTime)}
                      </span>
                    </div>

                    {/* Caller Info */}
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">
                          {call.callerName ? `👤 ${call.callerName}` : '📞 Caller'} 
                        </span>
                        {call.fromNumber && (
                          <span className="ml-2 text-muted-foreground">{call.fromNumber}</span>
                        )}
                      </p>
                    </div>

                    {/* Event Timeline */}
                    <div className="space-y-2 pl-4 border-l-2 border-input">
                      {call.events.map((event, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] w-4 h-4 bg-primary rounded-full border-2 border-white"></div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{formatTime(event.timestamp)}</span>
                            <span className="mx-2 text-muted-foreground/60">•</span>
                            <span className="text-foreground">{event.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
