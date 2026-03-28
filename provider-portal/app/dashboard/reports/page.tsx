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
  
  // Track which report is currently loading a fresh URL
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  
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
  
  /**
   * Check if a string is an S3 key (not a full URL)
   * S3 keys don't start with http/https
   */
  const isS3Key = (urlOrKey: string): boolean => {
    return !urlOrKey.startsWith('http');
  };
  
  /**
   * Get a fresh presigned URL for an S3 key or existing URL
   * This solves the 7-day expiration problem by generating URLs on-demand
   */
  const getFreshPresignedUrl = async (urlOrKey: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/provider/reports/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: urlOrKey,
          expiresIn: 3600, // 1 hour - enough for viewing/downloading
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.url) {
        return data.url;
      }
      
      console.error('Failed to get presigned URL:', data.error);
      return null;
    } catch (error) {
      console.error('Error fetching presigned URL:', error);
      return null;
    }
  };
  
  /**
   * Handle viewing a report - generates fresh URL if needed
   */
  const handleViewReport = async (report: Report) => {
    const pdfValue = report.fields.PDF;
    
    if (!pdfValue) {
      setReportsError('No PDF available for this report');
      return;
    }
    
    // If it's a full URL (old format), try to use it directly first
    // But we'll generate a fresh one to avoid expired URL issues
    setLoadingReportId(report.id);
    
    try {
      const freshUrl = await getFreshPresignedUrl(pdfValue);
      
      if (freshUrl) {
        window.open(freshUrl, '_blank');
      } else {
        // Fallback: try the stored URL (might work if not expired)
        if (!isS3Key(pdfValue)) {
          window.open(pdfValue, '_blank');
        } else {
          setReportsError('Unable to generate download URL. Please try again.');
        }
      }
    } finally {
      setLoadingReportId(null);
    }
  };
  
  /**
   * Handle downloading a report - generates fresh URL if needed
   */
  const handleDownload = async (report: Report) => {
    const pdfValue = report.fields.PDF;
    
    if (!pdfValue) {
      setReportsError('No PDF available for this report');
      return;
    }
    
    setLoadingReportId(report.id);
    
    try {
      const freshUrl = await getFreshPresignedUrl(pdfValue);
      
      if (freshUrl) {
        const link = document.createElement('a');
        link.href = freshUrl;
        link.target = '_blank';
        link.download = `${report.fields.Name}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Fallback: try the stored URL
        if (!isS3Key(pdfValue)) {
          const link = document.createElement('a');
          link.href = pdfValue;
          link.target = '_blank';
          link.download = `${report.fields.Name}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          setReportsError('Unable to generate download URL. Please try again.');
        }
      }
    } finally {
      setLoadingReportId(null);
    }
  };
  
  
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Reports</h1>
            <p className="text-muted-foreground mt-2">
              View and analyze your call activity reports
            </p>
          </div>
          
          <Link
            href="/dashboard/reports/today"
            className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Today (Live)
          </Link>
        </div>
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No call data available for the selected period
          </div>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      
      {/* Charts Section */}
      {statistics && statistics.totalCalls > 0 && (
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Analytics & Insights</h2>
            <p className="text-sm text-muted-foreground mt-1">
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
          <h2 className="text-lg font-semibold text-foreground">Daily Detailed Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View comprehensive daily reports with call logs, cancellations, and staff engagement
          </p>
        </div>
        
        {!statsLoading && statistics && statistics.callsByDate && statistics.callsByDate.length > 0 ? (
          <div className="bg-card rounded-xl shadow-sm border border-border/60 divide-y divide-border/60">
            {statistics.callsByDate.map((dayData) => {
              // dayData.date is already in YYYY-MM-DD format, use it directly
              const dateForLink = dayData.date;
              // Format for display without timezone conversion
              const displayDate = formatYYYYMMDDForDisplay(dayData.date, 'EEE, MMM d, yyyy');
              
              return (
                <Link
                  key={dayData.date}
                  href={`/dashboard/reports/${dateForLink}`}
                  className="p-4 hover:bg-muted/30 transition-colors duration-150 flex items-center justify-between gap-4 group"
                >
                  {/* Report Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="shrink-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        {displayDate}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{dayData.callCount} calls</span>
                        <span>•</span>
                        <span>{(dayData.totalDuration / 60).toFixed(1)} min</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* View Button */}
                  <div className="flex items-center gap-2 text-sm text-primary group-hover:text-primary font-medium shrink-0">
                    <span>View Report</span>
                    <Eye className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="bg-muted/30 border border-border/60 rounded-xl p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground">No call data available for the selected period</p>
          </div>
        )}
      </div>
      
      {/* Reports Section Title with Filter */}
      <div id="pdf-reports-section" className="mb-6 scroll-mt-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">PDF Reports</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Generated daily call summary reports
            </p>
          </div>
          
          {/* Compact Date Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 text-sm bg-muted/30 border border-input rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground/80">
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
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading reports...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Reports List */}
          {reports.length === 0 ? (
            <div className="bg-card rounded-xl shadow-sm border border-border/60 p-12 text-center">
              <FileText className="w-16 h-16 text-muted-foreground/60 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No reports available
              </h3>
              <p className="text-muted-foreground">
                Reports will appear here once they are generated
              </p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-xl shadow-sm border border-border/60 divide-y divide-border/60">
                {currentReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 hover:bg-muted/30 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Report Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="shrink-0">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {report.fields.Name}
                          </h3>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>{formatDate(report.fields.Date)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleViewReport(report)}
                          disabled={loadingReportId === report.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          {loadingReportId === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                          View
                        </button>
                        <button
                          onClick={() => handleDownload(report)}
                          disabled={loadingReportId === report.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          {loadingReportId === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
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
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, reports.length)} of {reports.length} report{reports.length !== 1 ? 's' : ''}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground/80 bg-card border border-input rounded-lg hover:bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            pageNum === currentPage
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground/80 bg-card border border-input hover:bg-muted/30'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground/80 bg-card border border-input rounded-lg hover:bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
