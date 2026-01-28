/**
 * Report Scheduler - Automated Daily Report Generation
 * Runs at midnight AEST to generate provider call summary reports
 */

import * as cron from 'node-cron';
import { logger } from '../../lib/logger';

// Track the scheduled task
let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Generate daily reports by calling our own API endpoint
 */
async function generateDailyReports() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting scheduled daily report generation', {
      timestamp: new Date().toISOString(),
      timezone: 'Australia/Sydney',
      type: 'cron_report_start'
    });

    // Determine the API endpoint URL
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000';
    
    const apiUrl = `${baseUrl}/api/reports/daily-call-summary`;

    logger.info('Calling report generation API', {
      url: apiUrl,
      type: 'cron_report_api_call'
    });

    // Make POST request to generate reports (no date = yesterday's report)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})  // Empty body = use yesterday's date
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    // Parse response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Failed to parse response: ${responseText.substring(0, 200)}`);
    }

    const duration = Date.now() - startTime;

    if (data.success) {
      logger.info('Scheduled daily report generation completed successfully', {
        date: data.date,
        totalCalls: data.totalCalls,
        totalProviders: data.summary?.total || 0,
        successful: data.summary?.successful || 0,
        failed: data.summary?.failed || 0,
        duration,
        type: 'cron_report_success'
      });

      console.log('✅ Daily Reports Generated Successfully');
      console.log(`   Date: ${data.date}`);
      console.log(`   Providers: ${data.summary?.successful || 0}/${data.summary?.total || 0} successful`);
      console.log(`   Total Calls: ${data.totalCalls}`);
      console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    } else {
      logger.warn('Scheduled daily report generation returned no data', {
        date: data.date,
        error: data.error,
        duration,
        type: 'cron_report_no_data'
      });

      console.log('⚠️  No reports generated (no data found)');
      console.log(`   Date: ${data.date}`);
      console.log(`   Error: ${data.error || 'No call logs found'}`);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Scheduled daily report generation failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      duration,
      type: 'cron_report_error'
    });

    console.error('❌ Daily Report Generation Failed');
    console.error(`   Error: ${errorMessage}`);
    console.error(`   Duration: ${Math.round(duration / 1000)}s`);
  }
}

/**
 * Initialize the report scheduler
 * Runs at midnight AEST every day
 */
export function initializeReportScheduler() {
  try {
    // Schedule for midnight AEST
    // Cron expression: '0 0 * * *' = At 00:00 every day
    scheduledTask = cron.schedule('0 0 * * *', generateDailyReports, {
      timezone: 'Australia/Sydney',
      scheduled: true
    });
    
    logger.info('Report scheduler initialized', {
      schedule: '0 0 * * * (midnight AEST)',
      timezone: 'Australia/Sydney',
      type: 'cron_initialized'
    });

    console.log('📅 Report Scheduler: Midnight AEST daily');

  } catch (error) {
    logger.error('Failed to initialize report scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'cron_init_error'
    });
    throw error;
  }
}

/**
 * Shutdown the report scheduler gracefully
 */
export function shutdownReportScheduler() {
  try {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
      
      logger.info('Report scheduler shut down', {
        type: 'cron_shutdown'
      });
      
      console.log('📅 Report Scheduler stopped');
    }
  } catch (error) {
    logger.error('Error shutting down report scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'cron_shutdown_error'
    });
    throw error;
  }
}

/**
 * Manually trigger report generation (for testing)
 * This can be called directly without waiting for the scheduled time
 */
export async function triggerReportGeneration() {
  logger.info('Manual report generation triggered', {
    type: 'cron_manual_trigger'
  });
  await generateDailyReports();
}

