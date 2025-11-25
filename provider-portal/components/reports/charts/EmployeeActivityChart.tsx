/**
 * Employee Activity Chart
 * Horizontal bar chart showing calls per employee
 */

'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { EmployeeStats } from '@/lib/report-aggregation';

interface EmployeeActivityChartProps {
  data: EmployeeStats[];
}

export default function EmployeeActivityChart({ data }: EmployeeActivityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Activity</h3>
        <div className="h-80 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-sm">No employee data available</p>
            <p className="text-xs mt-1">Select a different date range</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Take top 10 employees
  const topEmployees = data.slice(0, 10);
  
  // Transform data for chart
  const chartData = topEmployees.map(emp => ({
    name: emp.employeeName.length > 20 ? emp.employeeName.substring(0, 20) + '...' : emp.employeeName,
    fullName: emp.employeeName,
    calls: emp.callCount,
    avgDuration: Math.round(emp.averageDuration)
  }));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-chart="employee-activity">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Employee Activity</h3>
        {data.length > 10 && (
          <span className="text-xs text-gray-500">Top 10 of {data.length}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            type="number" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            width={90}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: any, name: string) => {
              if (name === 'calls') return [value, 'Calls Handled'];
              if (name === 'avgDuration') return [`${value}s`, 'Avg Duration'];
              return [value, name];
            }}
            labelFormatter={(label: any, payload: any) => {
              if (payload && payload[0]) {
                return `Employee: ${payload[0].payload.fullName}`;
              }
              return label;
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => value === 'calls' ? 'Calls Handled' : 'Avg Duration (s)'}
          />
          <Bar 
            dataKey="calls" 
            fill="#3b82f6" 
            radius={[0, 4, 4, 0]}
          />
          <Bar 
            dataKey="avgDuration" 
            fill="#8b5cf6" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

