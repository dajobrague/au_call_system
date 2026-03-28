'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Shift {
  id: string;
  time: string;
  employee: string;
  patient: string;
  status: string;
}

interface TodayOccurrencesCardProps {
  shifts: Shift[];
  loading?: boolean;
}

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'completed') return 'neutral' as const;
  if (s === 'scheduled') return 'success' as const;
  if (s === 'cancelled' || s === 'canceled') return 'danger' as const;
  if (s === 'open' || s.includes('unfilled')) return 'warning' as const;
  return 'neutral' as const;
}

function isOpenShift(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'open' || s.includes('unfilled');
}

function SkeletonRow() {
  return (
    <div className="px-5 py-3 flex items-center gap-3 border-b border-border/30 last:border-b-0">
      <div className="h-4 w-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-20 animate-pulse rounded-lg bg-muted flex-1" />
      <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export default function TodayOccurrencesCard({
  shifts,
  loading,
}: TodayOccurrencesCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Today&apos;s shifts
        </h3>
        <Link
          href="/dashboard/occurrences"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all &rarr;
        </Link>
      </div>

      {loading ? (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No shifts scheduled for today
        </div>
      ) : (
        <div>
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="px-5 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                  {shift.time}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm truncate',
                      isOpenShift(shift.status)
                        ? 'text-destructive font-medium'
                        : 'text-foreground',
                    )}
                  >
                    {isOpenShift(shift.status) ? 'OPEN' : shift.employee}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {shift.patient}
                  </p>
                </div>
                <Badge variant={statusVariant(shift.status)} className="shrink-0">
                  {shift.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
