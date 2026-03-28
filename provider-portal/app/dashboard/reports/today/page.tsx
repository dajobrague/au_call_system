'use client';

import { useState } from 'react';
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

  const { data, error, mutate, isLoading } = useSWR<LiveCallLogData>(
    `/api/provider/live-call-log?timeRange=${timeRange}`,
    fetcher,
    { refreshInterval: autoRefresh ? 30000 : 0, revalidateOnFocus: true }
  );

  const handleRefresh = () => mutate();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const formatRelativeTime = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div>
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Live Call Log</h1>
            <p className="text-muted-foreground mt-1">Real-time view of today&apos;s call activity</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">
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
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground/80 bg-card border border-input rounded-lg hover:bg-muted/30 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Time range</p>
        <div className="flex flex-wrap gap-1.5">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                timeRange === range.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-input text-foreground/70 hover:bg-muted/50'
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
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold text-foreground">{data.totalCalls}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-foreground">{data.inProgressCalls}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-lg font-semibold text-foreground">{formatRelativeTime(data.lastUpdated)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Call Log */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Call Activity {data && `(${data.totalCalls} ${data.totalCalls === 1 ? 'call' : 'calls'})`}
          </h2>
        </div>

        <div className="p-5">
          {error && (
            <div className="text-center py-8 text-destructive">
              Failed to load call log. Please try again.
            </div>
          )}

          {isLoading && !data && (
            <div className="text-center py-8 text-muted-foreground">Loading call log...</div>
          )}

          {data && data.calls.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No calls in the selected time range.
            </div>
          )}

          {data && data.calls.length > 0 && (
            <div className="space-y-5">
              {data.calls.map((call) => (
                <div
                  key={call.callSid}
                  className={`border rounded-xl p-4 ${
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
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
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
                        {call.endTime && ` – ${formatTime(call.endTime)}`}
                        {call.duration != null && ` (${Math.floor(call.duration / 60)}m ${call.duration % 60}s)`}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatRelativeTime(call.startTime)}</span>
                  </div>

                  {/* Caller Info */}
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">
                        {call.callerName ? `👤 ${call.callerName}` : '📞 Caller'}
                      </span>
                      {call.fromNumber && <span className="ml-2 text-muted-foreground">{call.fromNumber}</span>}
                    </p>
                  </div>

                  {/* Event Timeline */}
                  <div className="space-y-2 pl-4 border-l-2 border-border/60">
                    {call.events.map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] w-4 h-4 bg-primary rounded-full border-2 border-card" />
                        <div className="text-sm">
                          <span className="text-muted-foreground">{formatTime(event.timestamp)}</span>
                          <span className="mx-2 text-muted-foreground/60">·</span>
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
  );
}
