/**
 * Download Utilities for Reports
 * Handles PDF downloads and ZIP creation
 */

import JSZip from 'jszip';

export interface ReportFile {
  name: string;
  url: string;
}

/**
 * Download multiple PDFs as a ZIP file
 */
export async function downloadReportsAsZip(
  reports: ReportFile[],
  zipFileName: string
): Promise<void> {
  if (reports.length === 0) {
    throw new Error('No reports to download');
  }
  
  // For single report, just download directly
  if (reports.length === 1) {
    window.open(reports[0].url, '_blank');
    return;
  }
  
  const zip = new JSZip();
  const folder = zip.folder('reports');
  
  if (!folder) {
    throw new Error('Failed to create ZIP folder');
  }
  
  // Fetch all PDFs and add to ZIP
  const promises = reports.map(async (report, index) => {
    try {
      const response = await fetch(report.url);
      if (!response.ok) {
        console.warn(`Failed to fetch ${report.name}`);
        return null;
      }
      
      const blob = await response.blob();
      const fileName = `${index + 1}_${sanitizeFileName(report.name)}.pdf`;
      folder.file(fileName, blob);
      return fileName;
    } catch (error) {
      console.error(`Error fetching ${report.name}:`, error);
      return null;
    }
  });
  
  await Promise.all(promises);
  
  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  // Trigger download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = `${sanitizeFileName(zipFileName)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(link.href);
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[^a-z0-9\-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Download a single file
 */
export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

