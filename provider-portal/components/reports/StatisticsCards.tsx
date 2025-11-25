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
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      id: 'duration',
      label: 'Total Duration',
      value: formatDuration(totalDuration),
      icon: Clock,
      color: 'bg-green-500',
      lightColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      id: 'average',
      label: 'Avg Duration',
      value: formatDuration(averageDuration),
      icon: TrendingUp,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    {
      id: 'employees',
      label: 'Active Staff',
      value: activeEmployees.toString(),
      icon: Users,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-50',
      textColor: 'text-orange-700'
    }
  ];
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
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
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.lightColor} p-3 rounded-lg`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-gray-900">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-gray-600">
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

