'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatsRow from '@/components/dashboard/StatsRow';
import RecentCallsCard from '@/components/dashboard/RecentCallsCard';
import TodayOccurrencesCard from '@/components/dashboard/TodayOccurrencesCard';
import QuickActions from '@/components/dashboard/QuickActions';

interface Stats {
  totalCalls: number;
  totalTalkTimeSeconds: number;
  activeEmployees: number;
  activePatients: number;
}

interface Call {
  id: string;
  startedAt: string;
  intent: string;
  seconds: number;
  direction: string;
}

interface Shift {
  id: string;
  time: string;
  employee: string;
  patient: string;
  status: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [firstName, setFirstName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [stats, setStats] = useState<Stats>({
    totalCalls: 0,
    totalTalkTimeSeconds: 0,
    activeEmployees: 0,
    activePatients: 0,
  });
  const [recentCalls, setRecentCalls] = useState<Call[]>([]);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/provider/info')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.user) {
            setFirstName(data.user.fields['First Name'] || '');
          }
          if (data.provider) {
            setProviderName(
              (data.provider.fields.Name as string) || 'Provider Portal',
            );
          }
        }
      })
      .catch(() => {});

    fetch('/api/provider/dashboard-stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.data.stats);
          setRecentCalls(data.data.recentCalls);
          setTodayShifts(data.data.todayShifts);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Greeting header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          {providerName && (
            <p className="text-sm text-muted-foreground mt-1">
              {providerName}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/reports/today"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Today (Live)
        </Link>
      </div>

      {/* Stats row */}
      <div className="mb-6">
        <StatsRow
          totalCalls={stats.totalCalls}
          totalTalkTimeSeconds={stats.totalTalkTimeSeconds}
          activeEmployees={stats.activeEmployees}
          activePatients={stats.activePatients}
          loading={loading}
        />
      </div>

      {/* Two-column: Recent calls + Today's shifts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RecentCallsCard calls={recentCalls} loading={loading} />
        <TodayOccurrencesCard shifts={todayShifts} loading={loading} />
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">
          Quick actions
        </p>
        <QuickActions />
      </div>
    </div>
  );
}
