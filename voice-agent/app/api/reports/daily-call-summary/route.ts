/**
 * Daily Call Summary Report API
 * Generates PDF reports for providers based on daily call logs
 * 
 * Designed to be called by Airtable automation at midnight AEST
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { 
  generateReportData, 
  getYesterdayAEST, 
  parseAESTDate,
  ProviderCallSummary 
} from '@/services/airtable/report-service';
import { generateProviderReportHTML } from '@/services/reports/pdf-template';
import { generatePdf } from '@/services/reports/pdf-generator';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { airtableClient } from '@/services/airtable/client';
import { format } from 'date-fns';
import { env } from '@/config/env';

const REPORTS_TABLE_ID = 'tblglgaQInesliTlR';

interface ReportRequest {
  date?: string; // YYYY-MM-DD format
  providerId?: string; // Optional: generate for specific provider only
}

interface ProviderReport {
  providerId: string;
  providerName: string;
  pdfUrl: string;
  callCount: number;
  totalDuration: number;
  success: boolean;
  error?: string;
  airtableRecordId?: string;
}

/**
 * Generate PDF report for a single provider
 */
async function generateProviderReport(
  provider: ProviderCallSummary,
  reportDate: string
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
  try {
    // Generate HTML
    const html = generateProviderReportHTML(provider, reportDate);
    
    // Convert to PDF
    const pdfResult = await generatePdf({
      html,
      fileName: `${provider.providerName}-${reportDate}.pdf`
    });

    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      throw new Error(pdfResult.error || 'PDF generation failed');
    }

    return {
      success: true,
      pdfBuffer: pdfResult.pdfBuffer
    };

  } catch (error) {
    logger.error('Failed to generate provider report', {
      provider: provider.providerName,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'provider_report_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Upload PDF to S3
 */
async function uploadReportToS3(
  pdfBuffer: Buffer,
  provider: ProviderCallSummary,
  reportDate: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Generate S3 key: reports/{YYYY}/{MM}/{provider-name}-{YYYY-MM-DD}.pdf
    const date = new Date(reportDate);
    const year = format(date, 'yyyy');
    const month = format(date, 'MM');
    const providerSlug = provider.providerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const key = `reports/${year}/${month}/${providerSlug}-${reportDate}.pdf`;

    // Check if S3 credentials are available
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
      throw new Error('S3 credentials not configured');
    }

    // Create S3 client
    const s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    });

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256', // SSE-S3
      Metadata: {
        'provider-id': provider.providerId,
        'provider-name': provider.providerName,
        'report-date': reportDate,
        'call-count': provider.callCount.toString(),
        'total-duration': provider.totalDuration.toString()
      }
    });

    await s3Client.send(command);

    // Generate presigned URL (valid for 7 days = 604800 seconds)
    // This allows access to the file even though the bucket is private
    const getCommand = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key
    });
    
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { 
      expiresIn: 604800 // 7 days
    });

    logger.info('PDF uploaded to S3 successfully', {
      provider: provider.providerName,
      key,
      presignedUrl: presignedUrl.substring(0, 100) + '...',
      type: 's3_upload_pdf_success'
    });

    return {
      success: true,
      url: presignedUrl
    };

  } catch (error) {
    logger.error('Failed to upload report to S3', {
      provider: provider.providerName,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 's3_upload_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Store report in Airtable Reports table with S3 URL
 */
async function storeReportInAirtable(
  provider: ProviderCallSummary,
  reportDate: string,
  s3Url: string
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    logger.info('Creating Airtable record with S3 URL', {
      provider: provider.providerName,
      date: reportDate,
      s3Url,
      type: 'airtable_create_with_url'
    });

    const fields: any = {
      'Provider': [provider.providerId],
      'Date': reportDate,
      'PDF': s3Url  // URL field - store as plain string
    };

    const record = await airtableClient.createRecord(REPORTS_TABLE_ID, fields);

    logger.info('Airtable record created successfully', {
      provider: provider.providerName,
      recordId: record.id,
      type: 'airtable_record_created'
    });

    return {
      success: true,
      recordId: record.id
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to store report in Airtable', {
      provider: provider.providerName,
      error: errorMessage,
      stack: errorStack,
      type: 'airtable_report_store_error'
    });

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * POST /api/reports/daily-call-summary
 * 
 * Request body:
 * {
 *   "date": "2025-10-14",  // Optional, defaults to yesterday AEST
 *   "providerId": "rec123" // Optional, generate for specific provider
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "date": "2025-10-14",
 *   "reports": [
 *     {
 *       "providerId": "rec123",
 *       "providerName": "Bay Area Family Practice",
 *       "pdfUrl": "https://...",
 *       "callCount": 15,
 *       "totalDuration": 2850,
 *       "success": true
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: ReportRequest = await request.json().catch(() => ({}));

    // Determine date range (default to yesterday AEST)
    let startDate: Date;
    let endDate: Date;
    let dateStr: string;

    if (body.date) {
      // Use provided date
      startDate = parseAESTDate(body.date);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      dateStr = body.date;
    } else {
      // Use yesterday AEST
      const yesterday = getYesterdayAEST();
      startDate = yesterday.start;
      endDate = yesterday.end;
      dateStr = format(startDate, 'yyyy-MM-dd');
    }

    logger.info('Generating daily call summary report', {
      date: dateStr,
      providerId: body.providerId,
      type: 'report_generation_start'
    });

    // Fetch and group call logs (no S3 needed for PDFs)
    const reportData = await generateReportData(startDate, endDate);

    logger.info('Report data fetched', {
      date: dateStr,
      providerCount: reportData.providers.length,
      totalCalls: reportData.totalCalls,
      type: 'report_data_fetched'
    });

    // Filter by provider if specified
    let providersToProcess = reportData.providers;
    if (body.providerId) {
      providersToProcess = reportData.providers.filter(
        p => p.providerId === body.providerId
      );
    }

    if (providersToProcess.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No providers found for the specified criteria',
        date: dateStr
      });
    }

    // Generate reports for each provider
    const reports: ProviderReport[] = [];

    for (const provider of providersToProcess) {
      logger.info('Processing provider report', {
        provider: provider.providerName,
        callCount: provider.callCount,
        type: 'provider_report_processing'
      });

      // Generate PDF
      const pdfResult = await generateProviderReport(provider, dateStr);

      if (!pdfResult.success || !pdfResult.pdfBuffer) {
        reports.push({
          providerId: provider.providerId,
          providerName: provider.providerName,
          pdfUrl: '',
          callCount: provider.callCount,
          totalDuration: provider.totalDuration,
          success: false,
          error: pdfResult.error
        });
        continue;
      }

      // Generate filename
      const providerSlug = provider.providerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const filename = `${providerSlug}-${dateStr}.pdf`;

      // Upload PDF to S3
      logger.info('Uploading PDF to S3', {
        provider: provider.providerName,
        pdfSize: pdfResult.pdfBuffer.length,
        filename,
        type: 's3_upload_attempt'
      });

      const uploadResult = await uploadReportToS3(
        pdfResult.pdfBuffer,
        provider,
        dateStr
      );

      if (!uploadResult.success || !uploadResult.url) {
        reports.push({
          providerId: provider.providerId,
          providerName: provider.providerName,
          pdfUrl: '',
          callCount: provider.callCount,
          totalDuration: provider.totalDuration,
          success: false,
          error: uploadResult.error || 'S3 upload failed'
        });
        continue;
      }

      logger.info('S3 upload successful', {
        provider: provider.providerName,
        s3Url: uploadResult.url,
        type: 's3_upload_success'
      });

      // Store report record in Airtable with S3 URL
      const airtableResult = await storeReportInAirtable(
        provider,
        dateStr,
        uploadResult.url
      );

      logger.info('Airtable store result', {
        provider: provider.providerName,
        success: airtableResult.success,
        error: airtableResult.error,
        recordId: airtableResult.recordId,
        type: 'airtable_store_result'
      });

      reports.push({
        providerId: provider.providerId,
        providerName: provider.providerName,
        pdfUrl: uploadResult.url,
        callCount: provider.callCount,
        totalDuration: provider.totalDuration,
        success: airtableResult.success,
        error: airtableResult.error,
        airtableRecordId: airtableResult.recordId
      });

      logger.info('Provider report completed', {
        provider: provider.providerName,
        success: airtableResult.success,
        s3Url: uploadResult.url,
        airtableRecordId: airtableResult.recordId,
        type: 'provider_report_completed'
      });
    }

    const successCount = reports.filter(r => r.success).length;
    const failureCount = reports.filter(r => !r.success).length;

    logger.info('Daily call summary report generation completed', {
      date: dateStr,
      totalProviders: reports.length,
      successful: successCount,
      failed: failureCount,
      duration: Date.now() - startTime,
      type: 'report_generation_completed'
    });

    return NextResponse.json({
      success: successCount > 0,
      date: dateStr,
      totalCalls: reportData.totalCalls,
      totalDuration: reportData.totalDuration,
      reports: reports.map(r => ({
        ...r,
        // Don't include the full base64 PDF in response for cleaner logs
        pdfUrl: r.pdfUrl && r.pdfUrl.startsWith('data:') 
          ? `PDF generated (${Math.round(r.pdfUrl.length / 1024)}KB)` 
          : r.pdfUrl
      })),
      summary: {
        total: reports.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    logger.error('Daily call summary report generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'report_generation_error'
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/daily-call-summary
 * Simple health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Daily Call Summary Report API',
    usage: 'POST with optional { date: "YYYY-MM-DD", providerId: "rec123" }'
  });
}

