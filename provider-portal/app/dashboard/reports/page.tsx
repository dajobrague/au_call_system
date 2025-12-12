/**
 * Daily Reports Page - Phase 3: With Statistics & Aggregation
 */

'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Calendar, Loader2, Archive, FileBarChart, Eye } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import DateSelector, { DateRange } from '@/components/reports/DateSelector';
import StatisticsCards from '@/components/reports/StatisticsCards';
import { useReportData } from '@/hooks/useReportData';
import CallVolumeChart from '@/components/reports/charts/CallVolumeChart';
import DurationBreakdownChart from '@/components/reports/charts/DurationBreakdownChart';
import EmployeeActivityChart from '@/components/reports/charts/EmployeeActivityChart';
import IntentDistributionChart from '@/components/reports/charts/IntentDistributionChart';
import { downloadReportsAsZip, type ReportFile } from '@/lib/download-utils';
import { generatePdfSummary } from '@/lib/pdf-summary-generator';
import { formatYYYYMMDDForDisplay } from '@/lib/timezone-utils';
import Link from 'next/link';

interface Report {
  id: string;
  fields: {
    Name: string;
    Date: string;
    PDF: string;
  };
}

// Get yesterday as default
function getYesterday(): DateRange {
  const yesterday = subDays(new Date(), 1);
  return {
    startDate: startOfDay(yesterday),
    endDate: endOfDay(yesterday),
    label: 'Yesterday'
  };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getYesterday());
  const [downloading, setDownloading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  
  // Use custom hook for call logs and statistics
  const { statistics, loading: statsLoading, error: statsError } = useReportData(dateRange);
  
  useEffect(() => {
    fetchReports(dateRange);
  }, [dateRange]);
  
  const fetchReports = async (range: DateRange) => {
    setReportsLoading(true);
    setReportsError('');
    
    try {
      const startDate = format(range.startDate, 'yyyy-MM-dd');
      const endDate = format(range.endDate, 'yyyy-MM-dd');
      
      const response = await fetch(
        `/api/provider/reports?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();
      
      if (data.success) {
        setReports(data.data);
      } else {
        setReportsError(data.error || 'Failed to fetch reports');
      }
    } catch (_err) {
      setReportsError('An error occurred while fetching reports');
    } finally {
      setReportsLoading(false);
    }
  };
  
  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange);
  };
  
  const loading = reportsLoading || statsLoading;
  const error = reportsError || statsError;
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };
  
  const handleDownload = (pdfUrl: string, reportName: string) => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.download = `${reportName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDownloadAllReports = async () => {
    if (reports.length === 0) return;
    
    setDownloading(true);
    
    try {
      const reportFiles: ReportFile[] = reports.map(report => ({
        name: report.fields.Name,
        url: report.fields.PDF
      }));
      
      const zipName = `reports-${format(dateRange.startDate, 'yyyy-MM-dd')}-to-${format(dateRange.endDate, 'yyyy-MM-dd')}`;
      
      await downloadReportsAsZip(reportFiles, zipName);
    } catch (error) {
      console.error('Error downloading reports:', error);
      alert('Failed to download reports. Please try again.');
    } finally {
      setDownloading(false);
    }
  };
  
  const handleGenerateSummary = async () => {
    if (!statistics) return;
    
    setGeneratingPdf(true);
    
    try {
      // Generate PDF with charts
      const pdfBlob = await generatePdfSummary({
        statistics,
        dateRange,
        providerName: 'Provider' // TODO: Get from session
      });
      
      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `summary-report-${format(dateRange.startDate, 'yyyy-MM-dd')}-to-${format(dateRange.endDate, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };
  
  
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Daily Reports</h1>
        <p className="text-gray-600 mt-2">
          View and analyze your call activity reports
        </p>
      </div>
      
      {/* Date Selector */}
      <div className="mb-8">
        <DateSelector 
          onDateRangeChange={handleDateRangeChange}
          initialDateRange={dateRange}
        />
      </div>
      
      {/* Statistics Cards */}
      <div className="mb-8">
        {statistics ? (
          <StatisticsCards
            totalCalls={statistics.totalCalls}
            totalDuration={statistics.totalDuration}
            averageDuration={statistics.averageDuration}
            activeEmployees={statistics.activeEmployees}
            loading={statsLoading}
          />
        ) : statsLoading ? (
          <StatisticsCards
            totalCalls={0}
            totalDuration={0}
            averageDuration={0}
            activeEmployees={0}
            loading={true}
          />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
            No call data available for the selected period
          </div>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {/* Charts Section */}
      {statistics && statistics.totalCalls > 0 && (
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Analytics & Insights</h2>
            <p className="text-sm text-gray-600 mt-1">
              Visual breakdown of call activity for the selected period
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call Volume Over Time */}
            <div className="lg:col-span-2">
              <CallVolumeChart data={statistics.callsByDate} />
            </div>
            
            {/* Duration Breakdown */}
            <DurationBreakdownChart data={statistics.callsByDuration} />
            
            {/* Intent Distribution */}
            <IntentDistributionChart data={statistics.callsByIntent} />
            
            {/* Employee Activity */}
            <div className="lg:col-span-2">
              <EmployeeActivityChart data={statistics.callsByEmployee} />
            </div>
          </div>
        </div>
      )}
      
      {/* Daily Detailed Reports Section */}
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Daily Detailed Reports</h2>
          <p className="text-sm text-gray-600 mt-1">
            View comprehensive daily reports with call logs, cancellations, and staff engagement
          </p>
        </div>
        
        {!statsLoading && statistics && statistics.callsByDate && statistics.callsByDate.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statistics.callsByDate.map((dayData) => {
              // dayData.date is already in YYYY-MM-DD format, use it directly
              const dateForLink = dayData.date;
              // Format for display without timezone conversion
              const displayDate = formatYYYYMMDDForDisplay(dayData.date, 'EEE, MMM d, yyyy');
              
              return (
                <Link
                  key={dayData.date}
                  href={`/dashboard/reports/${dateForLink}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 p-5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">{displayDate}</h3>
                    </div>
                    <Eye className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Calls:</span>
                      <span className="font-medium text-gray-900">{dayData.callCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium text-gray-900">
                        {Math.round(dayData.totalDuration / 60)} min
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className="text-sm text-blue-600 group-hover:text-blue-700 font-medium">
                      View Detailed Report →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No call data available for the selected period</p>
          </div>
        )}
      </div>
      
      {/* Reports Section Title with Download Options */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Legacy PDF Reports</h2>
          <p className="text-sm text-gray-600 mt-1">
            Previously generated PDF reports for archival purposes
          </p>
        </div>
        
        {!reportsLoading && reports.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={handleDownloadAllReports}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Download All ({reports.length})
                </>
              )}
            </button>
            
            {statistics && statistics.totalCalls > 0 && (
              <button
                onClick={handleGenerateSummary}
                disabled={generatingPdf}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileBarChart className="w-4 h-4" />
                    Download PDF Summary
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading reports...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Reports Grid */}
          {reports.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No reports available
              </h3>
              <p className="text-gray-600">
                Reports will appear here once they are generated
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
                          {report.fields.Name}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>{formatDate(report.fields.Date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Footer */}
                  <div className="p-6">
                    <div className="flex gap-3">
                      <button
                        onClick={() => window.open(report.fields.PDF, '_blank')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(report.fields.PDF, report.fields.Name)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Reports Count */}
          {reports.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-600">
              Showing {reports.length} report{reports.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}
