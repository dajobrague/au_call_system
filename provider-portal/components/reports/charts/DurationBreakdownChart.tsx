/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Duration Breakdown Chart
 * Donut chart showing call duration distribution
 */

'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { DurationBuckets } from '@/lib/report-aggregation';

interface DurationBreakdownChartProps {
  data: DurationBuckets;
}

const COLORS = {
  short: '#ef4444',   // red
  medium: '#f59e0b',  // amber
  long: '#10b981'     // green
};

const LABELS = {
  short: 'Short (< 30s)',
  medium: 'Medium (30s-2min)',
  long: 'Long (> 2min)'
};

export default function DurationBreakdownChart({ data }: DurationBreakdownChartProps) {
  const total = data.short + data.medium + data.long;
  
  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Duration Breakdown</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-sm">No call data available</p>
            <p className="text-xs mt-1">Select a different date range</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Transform data for chart
  const chartData = [
    { name: LABELS.short, value: data.short, percentage: Math.round((data.short / total) * 100) },
    { name: LABELS.medium, value: data.medium, percentage: Math.round((data.medium / total) * 100) },
    { name: LABELS.long, value: data.long, percentage: Math.round((data.long / total) * 100) }
  ].filter(item => item.value > 0); // Only show non-zero segments
  
  const renderCustomLabel = (props: { name?: string; value?: number; percentage?: number }) => {
    return `${props.percentage || 0}%`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-chart="duration-breakdown">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Duration Breakdown</h3>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
          >
            {chartData.map((entry, index) => {
              const colorKey = entry.name.includes('Short') ? 'short' 
                : entry.name.includes('Medium') ? 'medium' 
                : 'long';
              return <Cell key={`cell-${index}`} fill={COLORS[colorKey]} />;
            })}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: number, name: string, props: any) => {
              return [`${value} calls (${props.payload.percentage}%)`, name];
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => {
              const payload = entry.payload;
              return `${value}: ${payload.value} (${payload.percentage}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

