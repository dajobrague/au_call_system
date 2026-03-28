/* eslint-disable @typescript-eslint/no-explicit-any */
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
      <div className="bg-card rounded-xl shadow-sm border border-border/60 p-6">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Employee Activity</h3>
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-sm">No employee data available</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Select a different date range</p>
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
    <div className="bg-card rounded-xl shadow-sm border border-border/60 p-6" data-chart="employee-activity">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Employee Activity</h3>
        {data.length > 10 && (
          <span className="text-xs text-muted-foreground">Top 10 of {data.length}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
          <XAxis 
            type="number" 
            stroke="hsl(220, 9%, 46%)"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="hsl(220, 9%, 46%)"
            style={{ fontSize: '12px' }}
            width={90}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(220, 13%, 91%)',
              borderRadius: '12px',
              padding: '12px',
              boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
              fontSize: '13px'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'calls') return [value, 'Calls Handled'];
              if (name === 'avgDuration') return [`${value}s`, 'Avg Duration'];
              return [value, name];
            }}
            labelFormatter={(label: string, payload: any) => {
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
            fill="#dc2626" 
            radius={[0, 4, 4, 0]}
          />
          <Bar 
            dataKey="avgDuration" 
            fill="#dc262633" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
