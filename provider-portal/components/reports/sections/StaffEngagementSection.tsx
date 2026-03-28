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
    <div className="bg-card border border-input rounded-lg p-6 mb-6 print:border-black">
      <h2 className="text-xl font-bold text-foreground mb-4 print:text-black">
        Staff Engagement Summary
      </h2>
      
      {staffEngagement.totalStaffContacted === 0 ? (
        <p className="text-muted-foreground print:text-black">No staff contacted during this period.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center print:bg-muted">
                <Users className="w-5 h-5 text-blue-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground print:text-black">
                  {staffEngagement.totalStaffContacted}
                </p>
                <p className="text-xs text-muted-foreground print:text-black">Total Contacted</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center print:bg-muted">
                <TrendingUp className="w-5 h-5 text-purple-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground print:text-black">
                  {staffEngagement.responseRate}%
                </p>
                <p className="text-xs text-muted-foreground print:text-black">Response Rate</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center print:bg-muted">
                <CheckCircle className="w-5 h-5 text-green-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground print:text-black">
                  {staffEngagement.accepted}
                </p>
                <p className="text-xs text-muted-foreground print:text-black">Accepted</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center print:bg-muted">
                <XCircle className="w-5 h-5 text-red-600 print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground print:text-black">
                  {staffEngagement.declined}
                </p>
                <p className="text-xs text-muted-foreground print:text-black">Declined</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-muted/50 rounded-lg flex items-center justify-center print:bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground print:text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground print:text-black">
                  {staffEngagement.didNotRespond}
                </p>
                <p className="text-xs text-muted-foreground print:text-black">No Response</p>
              </div>
            </div>
          </div>
          
          {staffEngagement.note && (
            <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-2 print:bg-muted/50 print:border-black">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5 print:text-black" />
              <p className="text-sm text-primary print:text-black">{staffEngagement.note}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
