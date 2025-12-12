/**
 * Snapshot Summary Section
 */

import type { SnapshotSummary } from '@/lib/daily-report-aggregation';
import { Phone, UserX, Send, CheckCircle, AlertCircle } from 'lucide-react';

interface SnapshotSectionProps {
  snapshot: SnapshotSummary;
}

export default function SnapshotSection({ snapshot }: SnapshotSectionProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-gray-900 mb-4 print:text-black">
        Snapshot Summary
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center print:bg-gray-200">
            <Phone className="w-5 h-5 text-blue-600 print:text-black" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 print:text-black">{snapshot.totalCalls}</p>
            <p className="text-xs text-gray-600 print:text-black">Total Calls</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center print:bg-gray-200">
            <UserX className="w-5 h-5 text-yellow-600 print:text-black" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 print:text-black">{snapshot.totalShiftCancellations}</p>
            <p className="text-xs text-gray-600 print:text-black">Shift Cancellations</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center print:bg-gray-200">
            <Send className="w-5 h-5 text-purple-600 print:text-black" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 print:text-black">{snapshot.totalDispatchAttempts}</p>
            <p className="text-xs text-gray-600 print:text-black">Dispatch Attempts</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center print:bg-gray-200">
            <CheckCircle className="w-5 h-5 text-green-600 print:text-black" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 print:text-black">{snapshot.successfulFills}</p>
            <p className="text-xs text-gray-600 print:text-black">Successful Fills</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center print:bg-gray-200 ${
            snapshot.issuesRequireFollowUp ? 'bg-red-100' : 'bg-gray-100'
          }`}>
            <AlertCircle className={`w-5 h-5 print:text-black ${
              snapshot.issuesRequireFollowUp ? 'text-red-600' : 'text-gray-400'
            }`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 print:text-black">
              {snapshot.issuesRequireFollowUp ? 'Yes' : 'No'}
            </p>
            <p className="text-xs text-gray-600 print:text-black">Issues to Follow-Up</p>
          </div>
        </div>
      </div>
    </div>
  );
}

