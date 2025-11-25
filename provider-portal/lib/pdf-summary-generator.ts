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

