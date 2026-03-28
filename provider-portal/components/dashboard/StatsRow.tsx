'use client';

import { Phone, Clock, Users, Hospital } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsRowProps {
  totalCalls: number;
  totalTalkTimeSeconds: number;
  activeEmployees: number;
  activePatients: number;
  loading?: boolean;
}

function formatTalkTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

const stats = [
  { key: 'calls', label: 'Calls', sub: 'last 7 days', icon: Phone },
  { key: 'talkTime', label: 'Talk time', sub: 'last 7 days', icon: Clock },
  { key: 'employees', label: 'Employees', sub: 'active', icon: Users },
  { key: 'patients', label: 'Patients', sub: 'active', icon: Hospital },
] as const;

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="w-10 h-10 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export default function StatsRow({
  totalCalls,
  totalTalkTimeSeconds,
  activeEmployees,
  activePatients,
  loading,
}: StatsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const values: Record<string, string | number> = {
    calls: totalCalls,
    talkTime: formatTalkTime(totalTalkTimeSeconds),
    employees: activeEmployees,
    patients: activePatients,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.key}
            className="rounded-xl border border-border/60 bg-card shadow-sm p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={cn('text-2xl font-bold text-foreground')}>
                  {values[stat.key]}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stat.label}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {stat.sub}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
