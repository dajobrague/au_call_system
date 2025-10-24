/**
 * PDF Template Generator
 * Generates branded HTML templates for call log reports
 */

import { ProviderCallSummary, CallLogRecord } from '../airtable/report-service';
import { format } from 'date-fns';

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy HH:mm');
  } catch {
    return dateString;
  }
}

/**
 * Generate HTML template for provider call log report
 */
export function generateProviderReportHTML(
  providerSummary: ProviderCallSummary,
  reportDate: string
): string {
  const { providerName, providerLogo, callCount, totalDuration, avgDuration, calls } = providerSummary;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Log Report - ${providerName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    
    .logo-container {
      flex-shrink: 0;
    }
    
    .logo {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .header-info {
      text-align: right;
    }
    
    .provider-name {
      font-size: 28px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 8px;
    }
    
    .report-title {
      font-size: 18px;
      color: #64748b;
      margin-bottom: 4px;
    }
    
    .report-date {
      font-size: 16px;
      color: #94a3b8;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .summary-card .label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #1e40af;
    }
    
    .summary-card .unit {
      font-size: 14px;
      color: #94a3b8;
      margin-top: 4px;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .calls-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
      font-size: 12px;
    }
    
    .recording-link {
      display: inline-block;
      padding: 6px 12px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      transition: background 0.2s;
    }
    
    .recording-link:hover {
      background: #1e40af;
    }
    
    .calls-table thead {
      background: #f1f5f9;
    }
    
    .calls-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    
    .calls-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    
    .calls-table tbody tr:hover {
      background: #f8fafc;
    }
    
    .call-direction {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .call-direction.inbound {
      background: #dbeafe;
      color: #1e40af;
    }
    
    .call-direction.outbound {
      background: #fce7f3;
      color: #be185d;
    }
    
    .duration {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #059669;
    }
    
    .intent {
      font-style: italic;
      color: #64748b;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .summary-card {
        break-inside: avoid;
      }
      
      .calls-table {
        page-break-inside: auto;
      }
      
      .calls-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${providerLogo ? `
    <div class="logo-container">
      <img src="${providerLogo}" alt="${providerName}" class="logo" />
    </div>
    ` : ''}
    <div class="header-info">
      ${!providerLogo ? `<div class="provider-name">${providerName}</div>` : ''}
      <div class="report-title">Daily Call Log Report</div>
      <div class="report-date">${reportDate}</div>
    </div>
  </div>
  
  <div class="summary-cards">
    <div class="summary-card">
      <div class="label">Total Calls</div>
      <div class="value">${callCount}</div>
    </div>
    
    <div class="summary-card">
      <div class="label">Total Duration</div>
      <div class="value">${formatDuration(totalDuration)}</div>
    </div>
    
    <div class="summary-card">
      <div class="label">Average Duration</div>
      <div class="value">${formatDuration(avgDuration)}</div>
    </div>
  </div>
  
  <h2 class="section-title">Call Details</h2>
  
  <table class="calls-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>Direction</th>
        <th>Employee</th>
        <th>Duration</th>
        <th>Intent/Action</th>
        <th>Recording</th>
      </tr>
    </thead>
    <tbody>
      ${calls.map(call => `
      <tr>
        <td>${formatDate(call.startedAt)}</td>
        <td>
          <span class="call-direction ${call.direction.toLowerCase()}">${call.direction}</span>
        </td>
        <td>${call.employeeName || 'N/A'}</td>
        <td class="duration">${formatDuration(call.seconds || 0)}</td>
        <td class="intent">${call.detectedIntent || 'N/A'}</td>
        <td>
          ${call.recordingUrl ? `<a href="${call.recordingUrl}" class="recording-link" target="_blank">▶ Play</a>` : 'N/A'}
        </td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  ${calls.length === 0 ? '<p style="text-align: center; color: #94a3b8; padding: 40px;">No calls recorded for this period.</p>' : ''}
  
  <div class="footer">
    <p>Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')} AEST</p>
    <p>First Priority Care / On Call After Hours Australia</p>
    <p style="margin-top: 8px; font-size: 11px;">This report contains confidential information. Please handle in accordance with NDIS privacy requirements.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate summary HTML for all providers (optional)
 */
export function generateSummaryReportHTML(
  providers: ProviderCallSummary[],
  reportDate: string,
  totalCalls: number,
  totalDuration: number
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Log Summary - All Providers</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    
    .title {
      font-size: 32px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 18px;
      color: #64748b;
    }
    
    .overall-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .stat-card .label {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 8px;
    }
    
    .stat-card .value {
      font-size: 36px;
      font-weight: bold;
      color: #1e40af;
    }
    
    .providers-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    
    .providers-table thead {
      background: #f1f5f9;
    }
    
    .providers-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    
    .providers-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .providers-table tbody tr:hover {
      background: #f8fafc;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Call Log Summary</div>
    <div class="subtitle">${reportDate}</div>
  </div>
  
  <div class="overall-stats">
    <div class="stat-card">
      <div class="label">Total Calls (All Providers)</div>
      <div class="value">${totalCalls}</div>
    </div>
    
    <div class="stat-card">
      <div class="label">Total Duration</div>
      <div class="value">${formatDuration(totalDuration)}</div>
    </div>
  </div>
  
  <table class="providers-table">
    <thead>
      <tr>
        <th>Provider</th>
        <th>Calls</th>
        <th>Total Duration</th>
        <th>Avg Duration</th>
      </tr>
    </thead>
    <tbody>
      ${providers.map(provider => `
      <tr>
        <td><strong>${provider.providerName}</strong></td>
        <td>${provider.callCount}</td>
        <td>${formatDuration(provider.totalDuration)}</td>
        <td>${formatDuration(provider.avgDuration)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px;">
    <p>Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')} AEST</p>
  </div>
</body>
</html>
  `.trim();
}

