/**
 * Production health check endpoint
 * Validates configuration and system readiness for deployment
 */

import { NextResponse } from 'next/server';
import { testElevenLabsConnection } from '../../../../src/services/elevenlabs/elevenlabs-service';
import { voiceMetrics } from '../../../../src/services/monitoring/voice-metrics';

export async function GET() {
  try {
    console.log('🏥 Production health check requested');

    // Check environment configuration
    const envConfig = {
      nodeEnv: process.env.NODE_ENV || 'development',
      appUrl: process.env.APP_URL || process.env.VERCEL_URL || 'localhost:3000',
      voiceAiEnabled: process.env.VOICE_AI_ENABLED === 'true',
      hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
      hasElevenLabsVoice: !!process.env.ELEVENLABS_VOICE_ID,
      hasTwilioConfig: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    };

    // Test ElevenLabs connection
    const elevenLabsTest = await testElevenLabsConnection();

    // Check WebSocket URL configuration
    const baseUrl = envConfig.appUrl;
    const protocol = baseUrl.includes('localhost') ? 'ws' : 'wss';
    const websocketUrl = `${protocol}://${baseUrl}/api/twilio/media-stream`;

    // Validate configuration
    const configValidation = {
      isProduction: envConfig.nodeEnv === 'production',
      hasSecureUrls: !baseUrl.includes('localhost'),
      voiceConfigured: envConfig.hasElevenLabsKey && envConfig.hasElevenLabsVoice,
      twilioConfigured: envConfig.hasTwilioConfig,
    };

    // Get system metrics
    const systemMetrics = voiceMetrics.getMetricsSummary();

    // Determine overall health
    const isHealthy = 
      elevenLabsTest.success &&
      configValidation.voiceConfigured &&
      configValidation.twilioConfigured &&
      systemMetrics.status !== 'critical';

    // Generate recommendations
    const recommendations = [];
    
    if (!configValidation.voiceConfigured) {
      recommendations.push('Configure ElevenLabs API key and voice ID');
    }
    
    if (!configValidation.twilioConfigured) {
      recommendations.push('Configure Twilio account SID and auth token');
    }
    
    if (configValidation.isProduction && !configValidation.hasSecureUrls) {
      recommendations.push('Use HTTPS URLs for production deployment');
    }
    
    if (!envConfig.voiceAiEnabled) {
      recommendations.push('Enable voice AI mode with VOICE_AI_ENABLED=true');
    }

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: envConfig,
      services: {
        elevenLabs: elevenLabsTest,
        websocket: {
          url: websocketUrl,
          protocol,
          configured: true,
        },
      },
      configuration: configValidation,
      metrics: systemMetrics,
      recommendations,
      readyForDeployment: isHealthy && configValidation.voiceConfigured && configValidation.twilioConfigured,
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method for health check',
    endpoint: '/api/production/health',
    method: 'GET',
  }, { status: 405 });
}
