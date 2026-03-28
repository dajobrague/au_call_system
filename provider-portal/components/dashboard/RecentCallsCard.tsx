'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Call {
  id: string;
  startedAt: string;
  intent: string;
  seconds: number;
  direction: string;
}

interface RecentCallsCardProps {
  calls: Call[];
  loading?: boolean;
}

function cleanIntent(raw: string): string {
  const first = raw.split(';')[0].trim();
  return first || 'General inquiry';
}

function relativeTime(isoString: string): string {
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return '';
  }
}

function SkeletonRow() {
  return (
    <div className="px-5 py-3 flex items-center justify-between border-b border-border/30 last:border-b-0">
      <div className="space-y-1.5">
        <div className="h-4 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-3 w-12 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default function RecentCallsCard({ calls, loading }: RecentCallsCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Recent calls</h3>
        <Link
          href="/dashboard/reports"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all &rarr;
        </Link>
      </div>

      {loading ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No calls in the last 7 days
        </div>
      ) : (
        <div>
          {calls.map((call) => (
            <div
              key={call.id}
              className="px-5 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      call.direction?.toLowerCase() === 'outbound'
                        ? 'bg-blue-500'
                        : 'bg-emerald-500',
                    )}
                  />
                  <p className="text-sm text-foreground truncate">
                    {cleanIntent(call.intent)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {relativeTime(call.startedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
