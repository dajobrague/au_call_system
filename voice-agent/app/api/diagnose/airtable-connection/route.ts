/**
 * Diagnostic Endpoint for Airtable Connection Testing
 * 
 * This endpoint tests the connection from Railway to Airtable API
 * and returns detailed diagnostics for debugging connectivity issues.
 * 
 * Usage:
 *   GET /api/diagnose/airtable-connection?phone=+61450236063
 *   GET /api/diagnose/airtable-connection?pin=1990
 * 
 * Returns JSON with timing, errors, and connection details
 */

import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

interface DiagnosticResult {
  success: boolean;
  testType: 'phone' | 'pin';
  testValue: string;
  timestamp: string;
  totalDuration: number;
  steps: DiagnosticStep[];
  employeeFound: boolean;
  employeeName?: string;
  employeePin?: number;
  errorDetails: ErrorDetails | null;
  railwayMetadata: RailwayMetadata;
  airtableResponse?: {
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
    recordCount?: number;
    recordSize?: number;
  };
}

interface DiagnosticStep {
  step: string;
  duration: number;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

interface ErrorDetails {
  message: string;
  code?: string;
  errno?: number;
  syscall?: string;
  hostname?: string;
  stack?: string;
}

interface RailwayMetadata {
  region?: string;
  environment?: string;
  serviceId?: string;
  deploymentId?: string;
  instanceId?: string;
  hostname?: string;
}

// Get Railway environment metadata
function getRailwayMetadata(): RailwayMetadata {
  return {
    region: process.env.RAILWAY_REGION || 'unknown',
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
    serviceId: process.env.RAILWAY_SERVICE_ID || 'unknown',
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
    instanceId: process.env.RAILWAY_REPLICA_ID || 'unknown',
    hostname: process.env.HOSTNAME || 'unknown',
  };
}

// Test DNS resolution
async function testDNSResolution(): Promise<DiagnosticStep> {
  const startTime = Date.now();
  try {
    const addresses = await resolve4('api.airtable.com');
    return {
      step: 'dns_resolution',
      duration: Date.now() - startTime,
      success: true,
      details: {
        ipAddresses: addresses,
        count: addresses.length,
      },
    };
  } catch (error) {
    return {
      step: 'dns_resolution',
      duration: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'DNS resolution failed',
      details: {
        errorCode: (error as NodeJS.ErrnoException).code,
      },
    };
  }
}

// Test Airtable connection
async function testAirtableConnection(
  testType: 'phone' | 'pin',
  testValue: string
): Promise<{
  step: DiagnosticStep;
  employeeData?: any;
  responseDetails?: any;
}> {
  const startTime = Date.now();
  
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      step: {
        step: 'airtable_request',
        duration: Date.now() - startTime,
        success: false,
        error: 'Missing Airtable credentials',
      },
    };
  }

  return new Promise((resolve) => {
    const filterFormula = testType === 'phone' 
      ? `{Phone} = '${testValue}'`
      : `{Employee PIN} = ${testValue}`;
    
    const encodedFormula = encodeURIComponent(filterFormula);
    const path = `/v0/${AIRTABLE_BASE_ID}/Employees?filterByFormula=${encodedFormula}&maxRecords=1&fields%5B%5D=Display+Name&fields%5B%5D=Employee+PIN&fields%5B%5D=Provider&fields%5B%5D=Phone&fields%5B%5D=Active`;

    const requestStartTime = Date.now();
    let connectionStartTime = 0;
    let firstByteTime = 0;

    const options = {
      hostname: 'api.airtable.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAgent-Diagnostics/1.0',
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      firstByteTime = Date.now() - requestStartTime;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const totalDuration = Date.now() - requestStartTime;
        
        try {
          const jsonData = JSON.parse(data);
          const employeeFound = jsonData.records && jsonData.records.length > 0;
          const employee = employeeFound ? jsonData.records[0].fields : null;
          
          resolve({
            step: {
              step: 'airtable_request',
              duration: totalDuration,
              success: res.statusCode === 200,
              details: {
                statusCode: res.statusCode,
                timeToFirstByte: firstByteTime,
                parseTime: Date.now() - requestStartTime - totalDuration,
                employeeFound,
                filterFormula,
              },
            },
            employeeData: employee,
            responseDetails: {
              statusCode: res.statusCode,
              headers: res.headers,
              recordCount: jsonData.records?.length || 0,
              recordSize: data.length,
            },
          });
        } catch (parseError) {
          resolve({
            step: {
              step: 'airtable_request',
              duration: totalDuration,
              success: false,
              error: 'JSON parse error',
              details: {
                statusCode: res.statusCode,
                rawDataLength: data.length,
                rawDataPreview: data.substring(0, 200),
              },
            },
            responseDetails: {
              statusCode: res.statusCode,
              headers: res.headers,
            },
          });
        }
      });
    });

    req.on('socket', (socket) => {
      socket.on('connect', () => {
        connectionStartTime = Date.now() - requestStartTime;
      });
    });

    req.on('error', (error) => {
      const errDetails = error as NodeJS.ErrnoException & { hostname?: string };
      resolve({
        step: {
          step: 'airtable_request',
          duration: Date.now() - requestStartTime,
          success: false,
          error: error.message || 'Request error',
          details: {
            errorCode: errDetails.code,
            errorErrno: errDetails.errno,
            errorSyscall: errDetails.syscall,
            hostname: errDetails.hostname,
            connectionTime: connectionStartTime || 'never_connected',
          },
        },
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        step: {
          step: 'airtable_request',
          duration: Date.now() - requestStartTime,
          success: false,
          error: 'Request timeout after 8000ms',
          details: {
            connectionTime: connectionStartTime || 'never_connected',
            firstByteTime: firstByteTime || 'no_data_received',
          },
        },
      });
    });

    req.end();
  });
}

// Main diagnostic function
async function runDiagnostic(
  testType: 'phone' | 'pin',
  testValue: string
): Promise<DiagnosticResult> {
  const overallStartTime = Date.now();
  const steps: DiagnosticStep[] = [];
  let errorDetails: ErrorDetails | null = null;
  let employeeFound = false;
  let employeeName: string | undefined;
  let employeePin: number | undefined;
  let airtableResponse: any = undefined;

  try {
    // Step 1: DNS Resolution
    const dnsStep = await testDNSResolution();
    steps.push(dnsStep);

    // Step 2: Airtable Connection
    const { step: airtableStep, employeeData, responseDetails } = await testAirtableConnection(
      testType,
      testValue
    );
    steps.push(airtableStep);
    airtableResponse = responseDetails;

    if (employeeData) {
      employeeFound = true;
      employeeName = employeeData['Display Name'];
      employeePin = employeeData['Employee PIN'];
    }

    // Check if we failed at any step
    const allStepsSucceeded = steps.every((s) => s.success);

    return {
      success: allStepsSucceeded && employeeFound,
      testType,
      testValue,
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - overallStartTime,
      steps,
      employeeFound,
      employeeName,
      employeePin,
      errorDetails,
      railwayMetadata: getRailwayMetadata(),
      airtableResponse,
    };
  } catch (error) {
    const err = error as Error & NodeJS.ErrnoException;
    errorDetails = {
      message: err.message || 'Unknown error',
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      stack: err.stack,
    };

    return {
      success: false,
      testType,
      testValue,
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - overallStartTime,
      steps,
      employeeFound: false,
      errorDetails,
      railwayMetadata: getRailwayMetadata(),
    };
  }
}

// API Route Handler
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get('phone');
    const pin = searchParams.get('pin');

    // Validate input
    if (!phone && !pin) {
      return NextResponse.json(
        {
          error: 'Missing parameter',
          message: 'Please provide either ?phone=+61450236063 or ?pin=1990',
          usage: {
            byPhone: '/api/diagnose/airtable-connection?phone=+61450236063',
            byPin: '/api/diagnose/airtable-connection?pin=1990',
          },
        },
        { status: 400 }
      );
    }

    if (phone && pin) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: 'Please provide only one parameter: either phone or pin, not both',
        },
        { status: 400 }
      );
    }

    // Run diagnostic
    const testType: 'phone' | 'pin' = phone ? 'phone' : 'pin';
    const testValue = phone || pin || '';

    const result = await runDiagnostic(testType, testValue);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Diagnostic endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

