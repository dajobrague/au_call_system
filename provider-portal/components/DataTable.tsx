/**
 * Reusable Data Table Component
 */

'use client';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, record: AirtableRecord) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: AirtableRecord[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function DataTable({ 
  columns, 
  data, 
  loading = false,
  emptyMessage = 'No data available'
}: DataTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border/60">
        <thead className="bg-muted/30">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border/60">
          {data.map((record, index) => (
            <tr key={record.id || index} className="hover:bg-muted/30">
              {columns.map((column) => {
                const value = record.fields[column.key];
                return (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-foreground"
                  >
                    {column.render 
                      ? column.render(value, record)
                      : (value as string) || '-'
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}








