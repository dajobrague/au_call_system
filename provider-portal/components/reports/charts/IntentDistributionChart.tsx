/**
 * Intent Distribution Chart
 * Pie chart showing distribution of call intents/actions
 */

'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { IntentStats } from '@/lib/report-aggregation';

interface IntentDistributionChartProps {
  data: IntentStats[];
}

// Color palette for intents
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export default function IntentDistributionChart({ data }: IntentDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Distribution</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-sm">No intent data available</p>
            <p className="text-xs mt-1">Select a different date range</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Take top 8 intents for clarity
  const topIntents = data.slice(0, 8);
  
  // Transform data for chart
  const chartData = topIntents.map(item => ({
    name: shortenIntent(item.intent),
    fullName: item.intent,
    value: item.count,
    percentage: item.percentage
  }));
  
  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage}%`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-chart="intent-distribution">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Intent Distribution</h3>
        {data.length > 8 && (
          <span className="text-xs text-gray-500">Top 8 of {data.length}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: any, name: string, props: any) => {
              return [`${value} calls (${props.payload.percentage}%)`, props.payload.fullName];
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={60}
            formatter={(value, entry: any) => {
              const payload = entry.payload;
              return `${payload.name}: ${payload.value} (${payload.percentage}%)`;
            }}
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Shorten intent names for display
 */
function shortenIntent(intent: string): string {
  const maxLength = 25;
  
  // Common shortenings
  const shortenings: Record<string, string> = {
    'Transferred to representative': 'Transfer',
    'Authenticated via phone': 'Phone Auth',
    'Authenticated via PIN': 'PIN Auth',
    'Selected job': 'Job Selection',
    'Left job open': 'Job Open',
    'Scheduled new occurrence': 'New Schedule',
  };
  
  // Check for exact match
  for (const [long, short] of Object.entries(shortenings)) {
    if (intent.includes(long)) {
      return short;
    }
  }
  
  // If too long, truncate
  if (intent.length > maxLength) {
    return intent.substring(0, maxLength) + '...';
  }
  
  return intent;
}

