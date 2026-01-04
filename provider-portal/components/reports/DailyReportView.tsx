/**
 * Daily Report View Component
 * Comprehensive daily report with all 8 sections
 */

'use client';

import { useState, useEffect } from 'react';
import type { DailyReportData } from '@/lib/daily-report-aggregation';
import HeaderSection from './sections/HeaderSection';
import SnapshotSection from './sections/SnapshotSection';
import CallLogSection from './sections/CallLogSection';
import AdditionalCommentsSection from './sections/AdditionalCommentsSection';
import ComplianceSection from './sections/ComplianceSection';
import AttachmentsSection from './sections/AttachmentsSection';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface DailyReportViewProps {
  reportData: DailyReportData;
  date: string;
  savedComments?: string;
  onDownloadPDF: (comments: string) => void;
  downloading?: boolean;
}

export default function DailyReportView({ 
  reportData, 
  date,
  savedComments = '',
  onDownloadPDF,
  downloading = false
}: DailyReportViewProps) {
  const [additionalComments, setAdditionalComments] = useState(savedComments || reportData.additionalComments);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Update comments when savedComments load from Redis
  useEffect(() => {
    if (savedComments) {
      setAdditionalComments(savedComments);
    }
  }, [savedComments]);
  
  // Auto-save comments to Redis when they change (debounced)
  useEffect(() => {
    if (additionalComments === savedComments) {
      setSaveStatus('saved');
      return;
    }
    
    setSaveStatus('unsaved');
    
    const saveTimer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fetch('/api/provider/report-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, comments: additionalComments })
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Error auto-saving comments:', err);
        setSaveStatus('unsaved');
      }
    }, 1000); // Save 1 second after typing stops
    
    return () => clearTimeout(saveTimer);
  }, [additionalComments, date, savedComments]);
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDownload = () => {
    onDownloadPDF(additionalComments);
  };
  
  return (
    <div className="min-h-screen print:bg-white print:m-0 print:p-0">
      {/* Report Content */}
      <div className="max-w-7xl mx-auto print:px-4 print:py-0 print:max-w-full">
        {/* Header Actions - Hidden when printing */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link 
            href="/dashboard/reports"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Reports</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>
        {/* Section 1: Header */}
        <HeaderSection header={reportData.header} />
        
        {/* Section 2: Snapshot Summary */}
        <SnapshotSection snapshot={reportData.snapshot} />
        
        {/* Section 3: Detailed Call Log */}
        <CallLogSection callLog={reportData.callLog} />
        
        {/* Section 4: Additional Comments */}
        <AdditionalCommentsSection 
          comments={additionalComments}
          onCommentsChange={setAdditionalComments}
          saveStatus={saveStatus}
        />
        
        {/* Section 5: Attachments / Raw Transcripts */}
        <AttachmentsSection attachments={reportData.attachments} />
        
        {/* Section 6: Compliance Notes (at the very bottom) */}
        <ComplianceSection compliance={reportData.compliance} />
        
        {/* Footer Note - Hidden when printing */}
        <div className="mt-8 text-center text-sm text-gray-500 print:hidden">
          <p>Report generated for {date}</p>
          <p className="mt-1">Add any additional comments above before downloading the PDF</p>
        </div>
      </div>
    </div>
  );
}

