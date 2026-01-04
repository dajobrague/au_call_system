/**
 * Daily Reports Page - Phase 3: With Statistics & Aggregation
 */

'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Calendar, Loader2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import DateSelector, { DateRange } from '@/components/reports/DateSelector';
import StatisticsCards from '@/components/reports/StatisticsCards';
import { useReportData } from '@/hooks/useReportData';
import CallVolumeChart from '@/components/reports/charts/CallVolumeChart';
import DurationBreakdownChart from '@/components/reports/charts/DurationBreakdownChart';
import EmployeeActivityChart from '@/components/reports/charts/EmployeeActivityChart';
import IntentDistributionChart from '@/components/reports/charts/IntentDistributionChart';
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
  
  // Date filter for PDF reports section - syncs with main date range or can be cleared
  const [pdfReportsStartDate, setPdfReportsStartDate] = useState<string>('');
  const [useSyncedFilter, setUseSyncedFilter] = useState(true); // Track if using synced filter
  
  // Pagination for PDF reports
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 5;
  
  // Use custom hook for call logs and statistics
  const { statistics, loading: statsLoading, error: statsError } = useReportData(dateRange);
  
  // Sync PDF filter with main date range when enabled
  useEffect(() => {
    if (useSyncedFilter && dateRange) {
      const syncedDate = format(dateRange.startDate, 'yyyy-MM-dd');
      setPdfReportsStartDate(syncedDate);
    }
  }, [dateRange, useSyncedFilter]);
  
  useEffect(() => {
    fetchReports();
    setCurrentPage(1); // Reset to first page when filter changes
  }, [pdfReportsStartDate]);
  
  const fetchReports = async () => {
    setReportsLoading(true);
    setReportsError('');
    
    try {
      // Build query params for date filtering
      let url = '/api/provider/reports';
      
      if (pdfReportsStartDate) {
        url += `?startDate=${pdfReportsStartDate}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        // Sort by date, most recent first
        const sortedReports = [...data.data].sort((a, b) => {
          const dateA = new Date(a.fields.Date);
          const dateB = new Date(b.fields.Date);
          return dateB.getTime() - dateA.getTime();
        });
        setReports(sortedReports);
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
    // Re-enable sync when main date range changes
    setUseSyncedFilter(true);
  };
  
  const handleClearPdfFilter = () => {
    setPdfReportsStartDate('');
    setUseSyncedFilter(false); // Disable sync when manually cleared
  };
  
  const loading = reportsLoading || statsLoading;
  const error = reportsError || statsError;
  
  // Calculate pagination
  const totalPages = Math.ceil(reports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const endIndex = startIndex + reportsPerPage;
  const currentReports = reports.slice(startIndex, endIndex);
  
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll to reports section
    document.getElementById('pdf-reports-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      // Parse date string directly to avoid timezone conversion
      // Airtable date format is YYYY-MM-DD
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
            {statistics.callsByDate.map((dayData) => {
              // dayData.date is already in YYYY-MM-DD format, use it directly
              const dateForLink = dayData.date;
              // Format for display without timezone conversion
              const displayDate = formatYYYYMMDDForDisplay(dayData.date, 'EEE, MMM d, yyyy');
              
              return (
                <Link
                  key={dayData.date}
                  href={`/dashboard/reports/${dateForLink}`}
                  className="p-4 hover:bg-gray-50 transition-colors duration-150 flex items-center justify-between gap-4 group"
                >
                  {/* Report Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {displayDate}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span>{dayData.callCount} calls</span>
                        <span>•</span>
                        <span>{(dayData.totalDuration / 60).toFixed(1)} min</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* View Button */}
                  <div className="flex items-center gap-2 text-sm text-blue-600 group-hover:text-blue-700 font-medium flex-shrink-0">
                    <span>View Report</span>
                    <Eye className="w-4 h-4" />
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
      
      {/* Reports Section Title with Filter */}
      <div id="pdf-reports-section" className="mb-6 scroll-mt-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">PDF Reports</h2>
            <p className="text-sm text-gray-600 mt-1">
              Generated daily call summary reports
            </p>
          </div>
          
          {/* Compact Date Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">
                {pdfReportsStartDate ? (
                  <>From: {format(new Date(pdfReportsStartDate + 'T00:00:00'), 'MMM d, yyyy')}</>
                ) : (
                  'All reports'
                )}
              </span>
            </div>
            {pdfReportsStartDate && (
              <button
                onClick={handleClearPdfFilter}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                title="Show all reports"
              >
                ✕
              </button>
            )}
          </div>
        </div>
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
          {/* Reports List */}
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
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                {currentReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Report Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {report.fields.Name}
                          </h3>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>{formatDate(report.fields.Date)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <a
                          href={report.fields.PDF}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          View
                        </a>
                        <button
                          onClick={() => handleDownload(report.fields.PDF, report.fields.Name)}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, reports.length)} of {reports.length} report{reports.length !== 1 ? 's' : ''}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                            pageNum === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
