/**
 * Daily Report View Component
 * Comprehensive daily report with all 8 sections
 */

'use client';

import { useState } from 'react';
import type { DailyReportData } from '@/lib/daily-report-aggregation';
import HeaderSection from './sections/HeaderSection';
import SnapshotSection from './sections/SnapshotSection';
import CallLogSection from './sections/CallLogSection';
import CancellationSection from './sections/CancellationSection';
import StaffEngagementSection from './sections/StaffEngagementSection';
import AdditionalCommentsSection from './sections/AdditionalCommentsSection';
import ComplianceSection from './sections/ComplianceSection';
import AttachmentsSection from './sections/AttachmentsSection';
import { Download, Printer, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface DailyReportViewProps {
  reportData: DailyReportData;
  date: string;
  onDownloadPDF: (comments: string, issuesRequireFollowUp: boolean) => void;
  downloading?: boolean;
}

export default function DailyReportView({ 
  reportData, 
  date,
  onDownloadPDF,
  downloading = false
}: DailyReportViewProps) {
  const [additionalComments, setAdditionalComments] = useState(reportData.additionalComments);
  const [issuesRequireFollowUp, setIssuesRequireFollowUp] = useState(reportData.issuesRequireFollowUp);
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDownload = () => {
    onDownloadPDF(additionalComments, issuesRequireFollowUp);
  };
  
  // Update snapshot with current issues flag
  const snapshotWithIssues = {
    ...reportData.snapshot,
    issuesRequireFollowUp,
  };
  
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white print:m-0 print:p-0">
      {/* Header Actions - Hidden when printing */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6 print:hidden no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link 
            href="/dashboard/reports"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Reports</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Report Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 print:px-4 print:py-0 print:max-w-full">
        {/* Issues Flag Toggle - Hidden when printing */}
        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6 print:hidden">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={issuesRequireFollowUp}
              onChange={(e) => setIssuesRequireFollowUp(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-5 h-5 ${issuesRequireFollowUp ? 'text-red-600' : 'text-gray-400'}`} />
              <span className="font-medium text-gray-900">
                Issues Requiring Follow-Up
              </span>
            </div>
          </label>
          <p className="text-sm text-gray-600 ml-8 mt-1">
            Check this box if there are issues that need manual follow-up or attention
          </p>
        </div>
        
        {/* Section 1: Header */}
        <HeaderSection header={reportData.header} />
        
        {/* Section 2: Snapshot Summary */}
        <SnapshotSection snapshot={snapshotWithIssues} />
        
        {/* Section 3: Detailed Call Log */}
        <CallLogSection callLog={reportData.callLog} />
        
        {/* Section 4: Shift Cancellation Workflow */}
        <CancellationSection cancellations={reportData.shiftCancellations} />
        
        {/* Section 5: Staff Engagement Summary */}
        <StaffEngagementSection staffEngagement={reportData.staffEngagement} />
        
        {/* Section 6: Additional Comments */}
        <AdditionalCommentsSection 
          comments={additionalComments}
          onCommentsChange={setAdditionalComments}
        />
        
        {/* Section 7: Compliance Notes */}
        <ComplianceSection compliance={reportData.compliance} />
        
        {/* Section 8: Attachments / Raw Transcripts */}
        <AttachmentsSection attachments={reportData.attachments} />
        
        {/* Footer Note - Hidden when printing */}
        <div className="mt-8 text-center text-sm text-gray-500 print:hidden">
          <p>Report generated for {date}</p>
          <p className="mt-1">Add any additional comments above before downloading the PDF</p>
        </div>
      </div>
    </div>
  );
}

