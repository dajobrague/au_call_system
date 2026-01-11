/**
 * Detailed Call Log Section
 */

import type { DetailedCallLog } from '@/lib/daily-report-aggregation';
import { Phone, User, Target, CheckCircle, AlertTriangle, Headphones } from 'lucide-react';

interface CallLogSectionProps {
  callLog: DetailedCallLog[];
}

export default function CallLogSection({ callLog }: CallLogSectionProps) {
  if (callLog.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
        <h2 className="text-xl font-bold text-gray-900 mb-4 print:text-black">
          Detailed Call Log
        </h2>
        <p className="text-gray-600 print:text-black">No calls received during this period.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-300 rounded-lg mb-6 print:border-black">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 print:text-black">
          Detailed Call Log ({callLog.length} {callLog.length === 1 ? 'call' : 'calls'})
        </h2>
      </div>
      
      <div className="overflow-y-auto overflow-x-auto max-h-96 print:max-h-none">
        <table className="w-full divide-y divide-gray-200 print:divide-black">
          <thead className="bg-gray-50 print:bg-white sticky top-0">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black whitespace-nowrap">
                Time
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black">
                Staff
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black">
                Patient
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black">
                Outcome
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black">
                Actions
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black">
                Resolution
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:text-black print:hidden whitespace-nowrap">
                Recording
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 print:divide-black">
            {callLog.map((call, index) => (
              <tr key={index} className={`hover:bg-gray-50 print:hover:bg-white ${call.issuesFlagged ? 'bg-red-50 print:bg-white' : ''}`}>
                <td className="px-3 py-3 text-sm text-gray-900 print:text-black whitespace-nowrap align-top">
                  <div className="flex items-center gap-2">
                    {call.issuesFlagged && (
                      <span title="Issue Flagged">
                        <AlertTriangle className="w-4 h-4 text-red-600 print:text-black flex-shrink-0" />
                      </span>
                    )}
                    <span>{call.timestamp}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 print:text-black align-top">
                  {call.identifiedStaff || '-'}
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 print:text-black align-top">
                  {call.identifiedPatient || '-'}
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 print:text-black align-top">
                  {call.outcome}
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 print:text-black align-top">
                  <ul className="list-disc list-inside space-y-1">
                    {call.actionsTaken.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-3 text-sm text-gray-900 print:text-black align-top">
                  {call.finalResolution}
                </td>
                <td className="px-3 py-3 text-sm print:hidden align-top whitespace-nowrap">
                  {call.recordingUrl ? (
                    <a 
                      href={call.recordingUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Headphones className="w-4 h-4" />
                      <span>Listen</span>
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

