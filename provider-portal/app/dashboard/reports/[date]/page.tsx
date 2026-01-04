/**
 * Daily Report Detail Page
 * Displays comprehensive daily report for a specific date
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import DailyReportView from '@/components/reports/DailyReportView';
import type { DailyReportData } from '@/lib/daily-report-aggregation';
import { generateComprehensiveDailyPDF } from '@/lib/pdf-summary-generator';
import { format, parse } from 'date-fns';

export default function DailyReportPage() {
  const params = useParams();
  const dateParam = params.date as string;
  
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [savedComments, setSavedComments] = useState('');
  
  useEffect(() => {
    if (dateParam) {
      fetchReportData(dateParam);
      fetchSavedComments(dateParam);
    }
  }, [dateParam]);
  
  const fetchSavedComments = async (date: string) => {
    try {
      const response = await fetch(`/api/provider/report-comments?date=${date}`);
      const data = await response.json();
      
      if (data.success && data.comments) {
        setSavedComments(data.comments);
      }
    } catch (err) {
      console.error('Error fetching saved comments:', err);
    }
  };
  
  const fetchReportData = async (date: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/provider/daily-report?date=${date}`);
      const data = await response.json();
      
      if (data.success) {
        setReportData(data.data);
      } else {
        setError(data.error || 'Failed to fetch report data');
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('An error occurred while loading the report');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDownloadPDF = async (comments: string) => {
    if (!reportData) return;
    
    setDownloading(true);
    
    try {
      // Update report data with user inputs
      const updatedReportData: DailyReportData = {
        ...reportData,
        additionalComments: comments,
      };
      
      // Generate PDF
      const pdfBlob = await generateComprehensiveDailyPDF(updatedReportData);
      
      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `daily-report-${dateParam}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading daily report...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Error Loading Report
              </h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={() => fetchReportData(dateParam)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">No report data available</p>
      </div>
    );
  }
  
  return (
    <DailyReportView 
      reportData={reportData}
      date={dateParam}
      savedComments={savedComments}
      onDownloadPDF={handleDownloadPDF}
      downloading={downloading}
    />
  );
}

