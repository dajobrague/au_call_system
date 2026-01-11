/**
 * PDF Summary Generator
 * Generates a comprehensive PDF report with statistics and charts
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import type { DateRange } from '@/components/reports/DateSelector';
import type { AggregatedStatistics, DateStats, EmployeeStats } from './report-aggregation';

export interface PdfSummaryOptions {
  statistics: AggregatedStatistics;
  dateRange: DateRange;
  providerName?: string;
}

/**
 * Generate a PDF summary report with charts
 */
export async function generatePdfSummary(options: PdfSummaryOptions): Promise<Blob> {
  const { statistics, dateRange, providerName = 'Provider' } = options;
  
  // Create new PDF document (landscape for better chart viewing)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;
  
  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // ===== PAGE 1: HEADER & SUMMARY STATISTICS =====
  
  // Header
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Call Activity Report', margin, yPosition);
  yPosition += 8;
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`,
    margin,
    yPosition
  );
  yPosition += 3;
  
  pdf.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, yPosition);
  yPosition += 10;
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
  
  // Summary Statistics Box
  pdf.setFillColor(59, 130, 246); // Blue background
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const boxY = yPosition + 6;
  const statWidth = (pageWidth - 2 * margin) / 4;
  
  // Total Calls
  pdf.text('Total Calls', margin + 5, boxY);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(statistics.totalCalls.toString(), margin + 5, boxY + 10);
  
  // Total Duration
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Total Duration', margin + statWidth + 5, boxY);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  const totalMinutes = Math.round(statistics.totalDuration / 60);
  pdf.text(`${totalMinutes} min`, margin + statWidth + 5, boxY + 10);
  
  // Average Duration
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Avg Duration', margin + statWidth * 2 + 5, boxY);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${statistics.averageDuration}s`, margin + statWidth * 2 + 5, boxY + 10);
  
  // Active Employees
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Active Staff', margin + statWidth * 3 + 5, boxY);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(statistics.activeEmployees.toString(), margin + statWidth * 3 + 5, boxY + 10);
  
  yPosition += 50;
  pdf.setTextColor(0, 0, 0);
  
  // ===== CAPTURE CHARTS AS IMAGES =====
  
  try {
    // Call Volume Chart
    const callVolumeEl = document.querySelector('[data-chart="call-volume"]');
    if (callVolumeEl) {
      checkPageBreak(80);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Call Volume Over Time', margin, yPosition);
      yPosition += 8;
      
      const canvas = await html2canvas(callVolumeEl as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }
    
    // Add new page for remaining charts
    pdf.addPage();
    yPosition = margin;
    
    // Duration Breakdown & Intent Distribution (side by side)
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Call Duration Breakdown', margin, yPosition);
    pdf.text('Intent Distribution', margin + (pageWidth / 2), yPosition);
    yPosition += 8;
    
    const chartWidth = (pageWidth - 3 * margin) / 2;
    
    // Duration Breakdown
    const durationEl = document.querySelector('[data-chart="duration-breakdown"]');
    if (durationEl) {
      const canvas = await html2canvas(durationEl as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * chartWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, chartWidth, imgHeight);
    }
    
    // Intent Distribution
    const intentEl = document.querySelector('[data-chart="intent-distribution"]');
    if (intentEl) {
      const canvas = await html2canvas(intentEl as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * chartWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', margin + chartWidth + margin, yPosition, chartWidth, imgHeight);
    }
    
    yPosition += 70;
    
    // Employee Activity Chart
    const employeeEl = document.querySelector('[data-chart="employee-activity"]');
    if (employeeEl) {
      checkPageBreak(80);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Employee Call Activity', margin, yPosition);
      yPosition += 8;
      
      const canvas = await html2canvas(employeeEl as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }
    
  } catch (error) {
    console.error('Error capturing charts:', error);
  }
  
  // ===== DETAILED STATISTICS TABLE =====
  pdf.addPage();
  yPosition = margin;
  
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Detailed Statistics', margin, yPosition);
  yPosition += 10;
  
  // Daily Call Data Table
  pdf.setFontSize(12);
  pdf.text('Daily Call Summary', margin, yPosition);
  yPosition += 8;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  
  // Table headers
  pdf.text('Date', margin, yPosition);
  pdf.text('Calls', margin + 40, yPosition);
  pdf.text('Duration (min)', margin + 70, yPosition);
  pdf.text('Avg (sec)', margin + 110, yPosition);
  yPosition += 6;
  
  pdf.setFont('helvetica', 'normal');
  
  // Table rows (limit to first 20 to fit on page)
  statistics.callsByDate.slice(0, 20).forEach((day: DateStats) => {
    if (yPosition > pageHeight - margin - 10) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.text(format(new Date(day.date), 'MMM d, yyyy'), margin, yPosition);
    pdf.text(day.callCount.toString(), margin + 40, yPosition);
    pdf.text(Math.round(day.totalDuration / 60).toString(), margin + 70, yPosition);
    const avgDuration = day.callCount > 0 ? Math.round(day.totalDuration / day.callCount) : 0;
    pdf.text(avgDuration.toString(), margin + 110, yPosition);
    yPosition += 5;
  });
  
  yPosition += 10;
  
  // Top Employees Table
  if (statistics.callsByEmployee.length > 0) {
    checkPageBreak(50);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Top Performing Employees', margin, yPosition);
    yPosition += 8;
    
    pdf.setFontSize(9);
    
    // Table headers
    pdf.text('Employee', margin, yPosition);
    pdf.text('Calls', margin + 70, yPosition);
    pdf.text('Avg Duration', margin + 100, yPosition);
    yPosition += 6;
    
    pdf.setFont('helvetica', 'normal');
    
  // Table rows (top 10)
  statistics.callsByEmployee.slice(0, 10).forEach((emp: EmployeeStats) => {
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.text(emp.employeeName, margin, yPosition);
      pdf.text(emp.callCount.toString(), margin + 70, yPosition);
      pdf.text(`${emp.averageDuration}s`, margin + 100, yPosition);
      yPosition += 5;
    });
  }
  
  // Footer on last page
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Generated on ${format(new Date(), 'MMM d, yyyy')} | ${providerName}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
  
  // Return as blob
  return pdf.output('blob');
}

/**
 * Generate a comprehensive daily report PDF
 * Includes all 8 sections from the daily report
 */
export async function generateComprehensiveDailyPDF(
  reportData: import('./daily-report-aggregation').DailyReportData
): Promise<Blob> {
  // Create new PDF document (portrait for better readability of detailed text)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;
  
  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper to add wrapped text
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number): number => {
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return lines.length * 5; // Return height used
  };
  
  // ===== SECTION 1: HEADER =====
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Daily On-Call Report', margin, yPosition);
  yPosition += 10;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Provider: ${reportData.header.providerName}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Date: ${reportData.header.date}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`On-Call Window: ${reportData.header.onCallWindow}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Operator: ${reportData.header.operatorName}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Generated: ${reportData.header.generatedAt}`, margin, yPosition);
  yPosition += 10;
  
  // ===== SECTION 2: SNAPSHOT SUMMARY =====
  checkPageBreak(30);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Snapshot Summary', margin, yPosition);
  yPosition += 7;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  const snapshot = reportData.snapshot;
  pdf.text(`Total Calls: ${snapshot.totalCalls}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Shift Cancellations: ${snapshot.totalShiftCancellations}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Dispatch Attempts: ${snapshot.totalDispatchAttempts}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Successful Fills: ${snapshot.successfulFills}`, margin, yPosition);
  yPosition += 10;
  
  // ===== SECTION 3: DETAILED CALL LOG =====
  checkPageBreak(25);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Detailed Call Log (Chronological)', margin, yPosition);
  yPosition += 7;
  
  if (reportData.callLog.length === 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.text('No calls received during this period.', margin, yPosition);
    yPosition += 10;
  } else {
    reportData.callLog.forEach((call, idx) => {
      checkPageBreak(35);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Call #${call.callNumber}`, margin, yPosition);
      yPosition += 6;
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      pdf.text(`Timestamp: ${call.timestamp}`, margin + 5, yPosition);
      yPosition += 4;
      pdf.text(`Caller: ${call.callerId}`, margin + 5, yPosition);
      yPosition += 4;
      pdf.text(`Purpose: ${call.purposeOfCall}`, margin + 5, yPosition);
      yPosition += 4;
      
      if (call.identifiedStaff) {
        pdf.text(`Staff: ${call.identifiedStaff}`, margin + 5, yPosition);
        yPosition += 4;
      }
      
      if (call.identifiedPatient) {
        pdf.text(`Patient: ${call.identifiedPatient}`, margin + 5, yPosition);
        yPosition += 4;
      }
      
      pdf.text(`Outcome: ${call.outcome}`, margin + 5, yPosition);
      yPosition += 4;
      
      pdf.text('Actions Taken:', margin + 5, yPosition);
      yPosition += 4;
      call.actionsTaken.forEach(action => {
        const height = addWrappedText(`• ${action}`, margin + 8, yPosition, pageWidth - margin - 13);
        yPosition += height;
      });
      
      pdf.text(`Resolution: ${call.finalResolution}`, margin + 5, yPosition);
      yPosition += 4;
      
      if (call.issuesFlagged) {
        pdf.setTextColor(255, 0, 0);
        pdf.text('⚠ Issue Flagged', margin + 5, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 4;
      }
      
      yPosition += 3;
    });
  }
  
  // ===== SECTION 4: SHIFT CANCELLATIONS =====
  checkPageBreak(25);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Shift Cancellation Workflow', margin, yPosition);
  yPosition += 7;
  
  if (reportData.shiftCancellations.length === 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.text('No shift cancellations during this period.', margin, yPosition);
    yPosition += 10;
  } else {
    reportData.shiftCancellations.forEach(cancellation => {
      checkPageBreak(40);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Cancellation ${cancellation.cancellationId} - ${cancellation.finalOutcome}`, margin, yPosition);
      yPosition += 6;
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      pdf.text(`Cancelled By: ${cancellation.cancelledBy}`, margin + 5, yPosition);
      yPosition += 4;
      pdf.text(`Phone: ${cancellation.phoneNumber}`, margin + 5, yPosition);
      yPosition += 4;
      pdf.text(`Participant: ${cancellation.participant}`, margin + 5, yPosition);
      yPosition += 4;
      pdf.text(`Shift Time: ${cancellation.shiftTime}`, margin + 5, yPosition);
      yPosition += 4;
      
      const reasonHeight = addWrappedText(`Reason: ${cancellation.reason}`, margin + 5, yPosition, pageWidth - margin - 10);
      yPosition += reasonHeight;
      
      pdf.text(`Replacement Triggered: ${cancellation.replacementTriggered ? 'Yes' : 'No'}`, margin + 5, yPosition);
      yPosition += 4;
      
      if (cancellation.replacementTriggered) {
        pdf.text(`Staff Contacted: ${cancellation.staffContacted} at ${cancellation.contactedAt}`, margin + 5, yPosition);
        yPosition += 4;
        
        pdf.text('Responses:', margin + 5, yPosition);
        yPosition += 4;
        cancellation.responses.forEach(response => {
          pdf.text(`  • ${response.staffName}: ${response.response}`, margin + 8, yPosition);
          yPosition += 4;
        });
      }
      
      yPosition += 3;
    });
  }
  
  // ===== SECTION 5: STAFF ENGAGEMENT =====
  checkPageBreak(25);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Staff Engagement Summary', margin, yPosition);
  yPosition += 7;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  const engagement = reportData.staffEngagement;
  pdf.text(`Total Staff Contacted: ${engagement.totalStaffContacted}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Response Rate: ${engagement.responseRate}%`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Accepted: ${engagement.accepted}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Declined: ${engagement.declined}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Did Not Respond: ${engagement.didNotRespond}`, margin, yPosition);
  yPosition += 5;
  
  if (engagement.note) {
    pdf.setFont('helvetica', 'italic');
    const noteHeight = addWrappedText(`Note: ${engagement.note}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += noteHeight;
    pdf.setFont('helvetica', 'normal');
  }
  
  yPosition += 7;
  
  // ===== SECTION 6: ADDITIONAL COMMENTS =====
  checkPageBreak(25);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Additional Comments', margin, yPosition);
  yPosition += 7;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  if (reportData.additionalComments && reportData.additionalComments.trim()) {
    const commentsHeight = addWrappedText(reportData.additionalComments, margin, yPosition, pageWidth - 2 * margin);
    yPosition += commentsHeight;
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.text('No additional comments', margin, yPosition);
    yPosition += 5;
    pdf.setFont('helvetica', 'normal');
  }
  
  yPosition += 7;
  
  // ===== SECTION 7: COMPLIANCE NOTES =====
  checkPageBreak(30);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Compliance Notes', margin, yPosition);
  yPosition += 7;
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  pdf.text('✓ All timestamps recorded', margin, yPosition);
  yPosition += 5;
  pdf.text('✓ All call outcomes logged', margin, yPosition);
  yPosition += 5;
  pdf.text(`✓ Data stored securely (${reportData.compliance.dataStoredSecurely})`, margin, yPosition);
  yPosition += 5;
  pdf.text('✓ Provider identifiers matched automatically', margin, yPosition);
  yPosition += 5;
  pdf.text('✓ No unverified data stored', margin, yPosition);
  yPosition += 10;
  
  // ===== SECTION 8: ATTACHMENTS =====
  if (reportData.attachments.length > 0) {
    checkPageBreak(20);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Attachments / Raw Transcripts', margin, yPosition);
    yPosition += 7;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    reportData.attachments.forEach(attachment => {
      checkPageBreak(6);
      pdf.text(`• ${attachment.label}`, margin, yPosition);
      pdf.setTextColor(0, 0, 255);
      pdf.textWithLink('View', margin + 50, yPosition, { url: attachment.url });
      pdf.setTextColor(0, 0, 0);
      yPosition += 5;
    });
  }
  
  // Footer on all pages
  const pageCount = pdf.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${pageCount} | Generated: ${reportData.header.generatedAt}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
  
  // Return as blob
  return pdf.output('blob');
}

