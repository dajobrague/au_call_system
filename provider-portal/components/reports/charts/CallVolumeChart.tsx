/**
 * Call Volume Over Time Chart
 * Line chart showing calls per day
 */

'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { DateStats } from '@/lib/report-aggregation';

interface CallVolumeChartProps {
  data: DateStats[];
}

export default function CallVolumeChart({ data }: CallVolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume Over Time</h3>
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
  const chartData = data.map(item => ({
    date: formatDate(item.date),
    fullDate: item.date,
    calls: item.callCount,
    duration: Math.round(item.totalDuration / 60) // Convert to minutes
  }));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-chart="call-volume">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume Over Time</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'Number of Calls', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: any, name: string) => {
              if (name === 'calls') return [value, 'Calls'];
              if (name === 'duration') return [`${value} min`, 'Total Duration'];
              return [value, name];
            }}
            labelFormatter={(label: any, payload: any) => {
              if (payload && payload[0]) {
                return `Date: ${payload[0].payload.fullDate}`;
              }
              return label;
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => value === 'calls' ? 'Number of Calls' : 'Duration (min)'}
          />
          <Line 
            type="monotone" 
            dataKey="calls" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="duration" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

