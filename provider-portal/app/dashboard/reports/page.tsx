'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Calendar, Loader2, Eye, ChevronLeft, ChevronRight, BarChart3, LayoutGrid, List } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import DateSelector, { DateRange } from '@/components/reports/DateSelector';
import StatisticsCards from '@/components/reports/StatisticsCards';
import { useReportData } from '@/hooks/useReportData';
import CallVolumeChart from '@/components/reports/charts/CallVolumeChart';
import DurationBreakdownChart from '@/components/reports/charts/DurationBreakdownChart';
import EmployeeActivityChart from '@/components/reports/charts/EmployeeActivityChart';
import IntentDistributionChart from '@/components/reports/charts/IntentDistributionChart';
import OverviewSparkline from '@/components/reports/OverviewSparkline';
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

type TabId = 'overview' | 'analytics' | 'daily';

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'daily', label: 'Daily reports', icon: List },
];

function getYesterday(): DateRange {
  const yesterday = subDays(new Date(), 1);
  return {
    startDate: startOfDay(yesterday),
    endDate: endOfDay(yesterday),
    label: 'Yesterday',
  };
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getYesterday());
  const [pdfReportsStartDate, setPdfReportsStartDate] = useState<string>('');
  const [useSyncedFilter, setUseSyncedFilter] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 5;
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const { statistics, loading: statsLoading, error: statsError } = useReportData(dateRange);

  useEffect(() => {
    if (useSyncedFilter && dateRange) {
      setPdfReportsStartDate(format(dateRange.startDate, 'yyyy-MM-dd'));
    }
  }, [dateRange, useSyncedFilter]);

  useEffect(() => {
    fetchReports();
    setCurrentPage(1);
  }, [pdfReportsStartDate]);

  const fetchReports = async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      let url = '/api/provider/reports';
      if (pdfReportsStartDate) url += `?startDate=${pdfReportsStartDate}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        const sorted = [...data.data].sort((a: Report, b: Report) =>
          new Date(b.fields.Date).getTime() - new Date(a.fields.Date).getTime()
        );
        setReports(sorted);
      } else {
        setReportsError(data.error || 'Failed to fetch reports');
      }
    } catch {
      setReportsError('An error occurred while fetching reports');
    } finally {
      setReportsLoading(false);
    }
  };

  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange);
    setUseSyncedFilter(true);
  };

  const handleClearPdfFilter = () => {
    setPdfReportsStartDate('');
    setUseSyncedFilter(false);
  };

  const error = reportsError || statsError;
  const totalPages = Math.ceil(reports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const endIndex = startIndex + reportsPerPage;
  const currentReports = reports.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    document.getElementById('pdf-reports-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const isS3Key = (urlOrKey: string): boolean => !urlOrKey.startsWith('http');

  const getFreshPresignedUrl = async (urlOrKey: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/provider/reports/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlOrKey, expiresIn: 3600 }),
      });
      const data = await response.json();
      if (data.success && data.url) return data.url;
      return null;
    } catch {
      return null;
    }
  };

  const handleViewReport = async (report: Report) => {
    const pdfValue = report.fields.PDF;
    if (!pdfValue) { setReportsError('No PDF available for this report'); return; }
    setLoadingReportId(report.id);
    try {
      const freshUrl = await getFreshPresignedUrl(pdfValue);
      if (freshUrl) { window.open(freshUrl, '_blank'); }
      else if (!isS3Key(pdfValue)) { window.open(pdfValue, '_blank'); }
      else { setReportsError('Unable to generate download URL. Please try again.'); }
    } finally { setLoadingReportId(null); }
  };

  const handleDownload = async (report: Report) => {
    const pdfValue = report.fields.PDF;
    if (!pdfValue) { setReportsError('No PDF available for this report'); return; }
    setLoadingReportId(report.id);
    try {
      const freshUrl = await getFreshPresignedUrl(pdfValue);
      const url = freshUrl || (!isS3Key(pdfValue) ? pdfValue : null);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = `${report.fields.Name}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setReportsError('Unable to generate download URL. Please try again.');
      }
    } finally { setLoadingReportId(null); }
  };

  const recentDays = statistics?.callsByDate
    ? [...statistics.callsByDate].reverse().slice(0, 5)
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">After-hours call activity and daily reports</p>
        </div>
        <Link
          href="/dashboard/reports/today"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Today
        </Link>
      </div>

      {/* Date Selector (inline toolbar) */}
      <div className="mb-6">
        <DateSelector onDateRangeChange={handleDateRangeChange} initialDateRange={dateRange} />
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border/60 mb-6">
        <nav className="flex gap-6" aria-label="Report tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats Row */}
          <div className="mb-6">
            {statistics ? (
              <StatisticsCards
                totalCalls={statistics.totalCalls}
                totalDuration={statistics.totalDuration}
                averageDuration={statistics.averageDuration}
                activeEmployees={statistics.activeEmployees}
                loading={statsLoading}
              />
            ) : statsLoading ? (
              <StatisticsCards totalCalls={0} totalDuration={0} averageDuration={0} activeEmployees={0} loading />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No call data available for the selected period
              </div>
            )}
          </div>

          {/* Two-column: Sparkline + Recent Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Sparkline */}
            <div className="lg:col-span-3">
              <OverviewSparkline data={statistics?.callsByDate || []} loading={statsLoading} />
            </div>

            {/* Recent daily reports */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="px-5 py-4 border-b border-border/40">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Recent reports</h3>
                </div>
                {statsLoading ? (
                  <div className="p-5 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3">
                        <div className="w-9 h-9 bg-muted rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentDays.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {recentDays.map((day) => (
                      <Link
                        key={day.date}
                        href={`/dashboard/reports/${day.date}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {formatYYYYMMDDForDisplay(day.date, 'EEE, MMM d')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {day.callCount} calls · {(day.totalDuration / 60).toFixed(0)}m
                          </p>
                        </div>
                        <Eye className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No reports for this period
                  </div>
                )}
                {recentDays.length > 0 && (
                  <div className="px-5 py-3 border-t border-border/40">
                    <button
                      onClick={() => setActiveTab('daily')}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View all daily reports →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {activeTab === 'analytics' && (
        <div>
          {statistics && statistics.totalCalls > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <CallVolumeChart data={statistics.callsByDate} />
              </div>
              <DurationBreakdownChart data={statistics.callsByDuration} />
              <IntentDistributionChart data={statistics.callsByIntent} />
              <div className="lg:col-span-2">
                <EmployeeActivityChart data={statistics.callsByEmployee} />
              </div>
            </div>
          ) : statsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm p-12 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No call data to analyze for the selected period</p>
            </div>
          )}
        </div>
      )}

      {/* ── Daily Reports Tab ── */}
      {activeTab === 'daily' && (
        <div>
          {/* Day-by-day call reports */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Daily call reports</h2>
            {!statsLoading && statistics?.callsByDate?.length ? (
              <div className="rounded-xl border border-border/60 bg-card shadow-sm divide-y divide-border/40">
                {statistics.callsByDate.map((dayData) => (
                  <Link
                    key={dayData.date}
                    href={`/dashboard/reports/${dayData.date}`}
                    className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">
                          {formatYYYYMMDDForDisplay(dayData.date, 'EEE, MMM d, yyyy')}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {dayData.callCount} calls · {(dayData.totalDuration / 60).toFixed(1)} min
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-primary font-medium shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      View report <Eye className="w-4 h-4" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-card shadow-sm p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No call data available for the selected period</p>
              </div>
            )}
          </div>

          {/* PDF Reports */}
          <div id="pdf-reports-section" className="scroll-mt-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">PDF reports</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-muted/30 border border-input rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-foreground/80">
                    {pdfReportsStartDate
                      ? `From: ${format(new Date(pdfReportsStartDate + 'T00:00:00'), 'MMM d, yyyy')}`
                      : 'All reports'}
                  </span>
                </div>
                {pdfReportsStartDate && (
                  <button onClick={handleClearPdfFilter} className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title="Show all reports">
                    ✕
                  </button>
                )}
              </div>
            </div>

            {reportsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-card shadow-sm p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No PDF reports available</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-card shadow-sm divide-y divide-border/40">
                  {currentReports.map((report) => (
                    <div key={report.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">{report.fields.Name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(report.fields.Date)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleViewReport(report)}
                            disabled={loadingReportId === report.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors disabled:opacity-50"
                          >
                            {loadingReportId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                            View
                          </button>
                          <button
                            onClick={() => handleDownload(report)}
                            disabled={loadingReportId === report.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {loadingReportId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {startIndex + 1}–{Math.min(endIndex, reports.length)} of {reports.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => handlePageChange(n)}
                          className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${n === currentPage ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-muted/50'}`}
                        >
                          {n}
                        </button>
                      ))}
                      <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
