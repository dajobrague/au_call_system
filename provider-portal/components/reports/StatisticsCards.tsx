/**
 * Statistics Cards Component
 * Displays summary metrics for call data
 */

'use client';

import { Phone, Clock, TrendingUp, Users } from 'lucide-react';
import { formatDuration } from '@/lib/report-aggregation';

interface StatisticsCardsProps {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  activeEmployees: number;
  loading?: boolean;
}

export default function StatisticsCards({
  totalCalls,
  totalDuration,
  averageDuration,
  activeEmployees,
  loading = false
}: StatisticsCardsProps) {
  const stats = [
    {
      id: 'calls',
      label: 'Total Calls',
      value: totalCalls.toLocaleString(),
      icon: Phone,
      color: 'bg-primary',
      lightColor: 'bg-primary/10',
      textColor: 'text-primary'
    },
    {
      id: 'duration',
      label: 'Total Duration',
      value: formatDuration(totalDuration),
      icon: Clock,
      color: 'bg-primary',
      lightColor: 'bg-primary/10',
      textColor: 'text-primary'
    },
    {
      id: 'average',
      label: 'Avg Duration',
      value: formatDuration(averageDuration),
      icon: TrendingUp,
      color: 'bg-primary',
      lightColor: 'bg-primary/10',
      textColor: 'text-primary'
    },
    {
      id: 'employees',
      label: 'Active Staff',
      value: activeEmployees.toString(),
      icon: Users,
      color: 'bg-primary',
      lightColor: 'bg-primary/10',
      textColor: 'text-primary'
    }
  ];
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl shadow-sm border border-border/60 p-6">
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-muted rounded-lg"></div>
              </div>
              <div className="h-7 bg-muted rounded w-20 mb-2"></div>
              <div className="h-4 bg-muted rounded w-28"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className="bg-card rounded-xl shadow-sm border border-border/60 hover:shadow-md transition-shadow duration-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.lightColor} p-3 rounded-lg`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
