'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DateStats } from '@/lib/report-aggregation';

interface OverviewSparklineProps {
  data: DateStats[];
  loading?: boolean;
}

export default function OverviewSparkline({ data, loading = false }: OverviewSparklineProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card shadow-sm p-5">
        <div className="h-4 w-28 bg-muted rounded mb-4 animate-pulse" />
        <div className="h-[200px] bg-muted/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  const chartData = data.map((item) => ({
    date: formatShortDate(item.date),
    calls: item.callCount,
  }));

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm p-5">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Call volume</h3>
      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="hsl(220, 9%, 46%)"
              style={{ fontSize: '11px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(220, 9%, 46%)"
              style={{ fontSize: '11px' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 13%, 91%)',
                borderRadius: '12px',
                padding: '10px 14px',
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                fontSize: '13px',
              }}
              formatter={(value: number) => [`${value} calls`, 'Calls']}
            />
            <Area
              type="monotone"
              dataKey="calls"
              stroke="#dc2626"
              strokeWidth={2}
              fill="url(#sparklineFill)"
              dot={false}
              activeDot={{ r: 4, fill: '#dc2626', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
