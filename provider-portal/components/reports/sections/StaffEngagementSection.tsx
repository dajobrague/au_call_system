/**
 * Staff Engagement Summary Section
 */

import type { StaffEngagementSummary } from '@/lib/daily-report-aggregation';
import { Users, TrendingUp, CheckCircle, XCircle, Clock, Info } from 'lucide-react';

interface StaffEngagementSectionProps {
  staffEngagement: StaffEngagementSummary;
}

export default function StaffEngagementSection({ staffEngagement }: StaffEngagementSectionProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-gray-900 mb-4 print:text-black">
        Staff Engagement Summary
      </h2>
      
      {staffEngagement.totalStaffContacted === 0 ? (
        <p className="text-gray-600 print:text-black">No staff contacted during this period.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center print:bg-gray-200">
                <Users className="w-5 h-5 text-blue-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 print:text-black">
                  {staffEngagement.totalStaffContacted}
                </p>
                <p className="text-xs text-gray-600 print:text-black">Total Contacted</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center print:bg-gray-200">
                <TrendingUp className="w-5 h-5 text-purple-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 print:text-black">
                  {staffEngagement.responseRate}%
                </p>
                <p className="text-xs text-gray-600 print:text-black">Response Rate</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center print:bg-gray-200">
                <CheckCircle className="w-5 h-5 text-green-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 print:text-black">
                  {staffEngagement.accepted}
                </p>
                <p className="text-xs text-gray-600 print:text-black">Accepted</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center print:bg-gray-200">
                <XCircle className="w-5 h-5 text-red-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 print:text-black">
                  {staffEngagement.declined}
                </p>
                <p className="text-xs text-gray-600 print:text-black">Declined</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center print:bg-gray-200">
                <Clock className="w-5 h-5 text-gray-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 print:text-black">
                  {staffEngagement.didNotRespond}
                </p>
                <p className="text-xs text-gray-600 print:text-black">No Response</p>
              </div>
            </div>
          </div>
          
          {staffEngagement.note && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 print:bg-gray-100 print:border-black">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 print:text-black" />
              <p className="text-sm text-blue-800 print:text-black">{staffEngagement.note}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

