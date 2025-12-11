/**
 * Deployment configuration for AI Voice Agent
 * Production deployment settings and validation
 */

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  urls: {
    app: string;
    webhook: string;
    websocket: string;
  };
  features: {
    voiceAI: boolean;
    fallbackMode: boolean;
    debugLogging: boolean;
  };
  security: {
    useHttps: boolean;
    validateTwilioSignature: boolean;
    rateLimiting: boolean;
  };
}

/**
 * Get deployment configuration
 */
export function getDeploymentConfig(): DeploymentConfig {
  const environment = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';
  // Priority: RAILWAY_PUBLIC_DOMAIN > APP_URL > localhost
  const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL || 'localhost:3000';
  const isLocalhost = appUrl.includes('localhost');
  const useHttps = !isLocalhost;
  
  return {
    environment,
    urls: {
      app: useHttps ? `https://${appUrl}` : `http://${appUrl}`,
      webhook: useHttps ? `https://${appUrl}/api/twilio/voice` : `http://${appUrl}/api/twilio/voice`,
      websocket: `${useHttps ? 'wss' : 'ws'}://${appUrl}/api/twilio/media-stream`,
    },
    features: {
      voiceAI: process.env.VOICE_AI_ENABLED === 'true',
      fallbackMode: environment === 'development',
      debugLogging: environment !== 'production',
    },
    security: {
      useHttps,
      validateTwilioSignature: environment === 'production',
      rateLimiting: environment === 'production',
    },
  };
}

/**
 * Validate deployment readiness
 */
export function validateDeploymentReadiness(): {
  ready: boolean;
  issues: string[];
  warnings: string[];
  config: DeploymentConfig;
} {
  const config = getDeploymentConfig();
  const issues: string[] = [];
  const warnings: string[] = [];

  // Critical checks
  if (!process.env.ELEVENLABS_API_KEY) {
    issues.push('Missing ELEVENLABS_API_KEY');
  }
  
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    issues.push('Missing Twilio configuration');
  }
  
  if (config.environment === 'production' && config.urls.app.includes('localhost')) {
    issues.push('Production environment cannot use localhost');
  }

  // Warning checks
  if (!process.env.ELEVENLABS_VOICE_ID) {
    warnings.push('Using default ElevenLabs voice (consider setting ELEVENLABS_VOICE_ID)');
  }
  
  if (config.environment === 'production' && !config.features.voiceAI) {
    warnings.push('Voice AI is disabled in production');
  }
  
  if (config.environment === 'production' && config.features.debugLogging) {
    warnings.push('Debug logging is enabled in production');
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    config,
  };
}

/**
 * Generate Twilio webhook configuration
 */
export function generateTwilioWebhookConfig(): {
  voiceUrl: string;
  voiceMethod: string;
  statusCallback?: string;
  mediaStreamUrl: string;
} {
  const config = getDeploymentConfig();
  
  return {
    voiceUrl: config.urls.webhook,
    voiceMethod: 'POST',
    statusCallback: `${config.urls.app}/api/twilio/status`,
    mediaStreamUrl: config.urls.websocket,
  };
}

/**
 * Log deployment configuration
 */
export function logDeploymentConfig(): void {
  const validation = validateDeploymentReadiness();
  const { config, ready, issues, warnings } = validation;
  
  console.log('🚀 Deployment Configuration:');
  console.log('============================');
  console.log(`Environment: ${config.environment}`);
  console.log(`App URL: ${config.urls.app}`);
  console.log(`Webhook URL: ${config.urls.webhook}`);
  console.log(`WebSocket URL: ${config.urls.websocket}`);
  console.log(`Voice AI: ${config.features.voiceAI ? 'Enabled' : 'Disabled'}`);
  console.log(`HTTPS: ${config.security.useHttps ? 'Yes' : 'No'}`);
  
  if (issues.length > 0) {
    console.error('❌ Deployment Issues:');
    issues.forEach(issue => console.error(`  - ${issue}`));
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Deployment Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  console.log(`\n${ready ? '✅ Ready for deployment' : '❌ Not ready for deployment'}`);
  
  if (ready) {
    const twilioConfig = generateTwilioWebhookConfig();
    console.log('\n📞 Twilio Configuration:');
    console.log(`Voice URL: ${twilioConfig.voiceUrl}`);
    console.log(`Media Stream URL: ${twilioConfig.mediaStreamUrl}`);
  }
}
