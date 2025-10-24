/**
 * PDF Generator Service
 * Converts HTML templates to PDF using Puppeteer
 */

import puppeteer from 'puppeteer';
import { logger } from '../../lib/logger';

export interface PdfGenerationOptions {
  html: string;
  fileName?: string;
}

export interface PdfGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  size?: number;
}

let browserInstance: any = null;

/**
 * Initialize Puppeteer browser (reusable instance)
 */
async function getBrowser() {
  if (browserInstance) {
    return browserInstance;
  }

  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    logger.info('Puppeteer browser initialized', {
      type: 'puppeteer_init'
    });

    return browserInstance;
  } catch (error) {
    logger.error('Failed to initialize Puppeteer', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'puppeteer_init_error'
    });
    throw error;
  }
}

/**
 * Generate PDF from HTML
 */
export async function generatePdf(
  options: PdfGenerationOptions
): Promise<PdfGenerationResult> {
  const startTime = Date.now();
  let page: any = null;

  try {
    logger.info('Starting PDF generation', {
      fileName: options.fileName,
      type: 'pdf_generation_start'
    });

    const browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport for consistent rendering (landscape orientation)
    await page.setViewport({
      width: 1600,
      height: 1200,
      deviceScaleFactor: 2
    });

    // Load HTML content
    await page.setContent(options.html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    // Generate PDF in landscape orientation
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,  // Horizontal/landscape orientation
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: false
    });

    await page.close();

    logger.info('PDF generated successfully', {
      fileName: options.fileName,
      size: pdfBuffer.length,
      duration: Date.now() - startTime,
      type: 'pdf_generation_success'
    });

    return {
      success: true,
      pdfBuffer: Buffer.from(pdfBuffer),
      size: pdfBuffer.length
    };

  } catch (error) {
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }

    logger.error('PDF generation failed', {
      fileName: options.fileName,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'pdf_generation_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Close browser instance (for cleanup)
 */
export async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      browserInstance = null;
      logger.info('Puppeteer browser closed', {
        type: 'puppeteer_closed'
      });
    } catch (error) {
      logger.error('Error closing Puppeteer browser', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'puppeteer_close_error'
      });
    }
  }
}

/**
 * Generate multiple PDFs in batch
 */
export async function generatePdfBatch(
  requests: PdfGenerationOptions[]
): Promise<PdfGenerationResult[]> {
  const results: PdfGenerationResult[] = [];

  logger.info('Starting batch PDF generation', {
    count: requests.length,
    type: 'pdf_batch_start'
  });

  for (const request of requests) {
    const result = await generatePdf(request);
    results.push(result);
  }

  logger.info('Batch PDF generation completed', {
    count: requests.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    type: 'pdf_batch_completed'
  });

  return results;
}

