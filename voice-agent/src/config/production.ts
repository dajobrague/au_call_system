/**
 * Production configuration for AI Voice Agent
 * Environment-specific settings for deployment
 */

export interface ProductionConfig {
  app: {
    url: string;
    environment: 'development' | 'staging' | 'production';
    websocketProtocol: 'ws' | 'wss';
  };
  voice: {
    enabled: boolean;
    elevenLabsVoiceId: string;
    fallbackToGoogle: boolean;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    webhookUrl: string;
    mediaStreamUrl: string;
  };
  monitoring: {
    enableDetailedLogging: boolean;
    enablePerformanceTracking: boolean;
    enableErrorReporting: boolean;
  };
  performance: {
    maxConcurrentCalls: number;
    audioBufferSize: number;
    responseTimeoutMs: number;
    maxCallDurationMs: number;
  };
}

/**
 * Get production configuration based on environment
 */
export function getProductionConfig(): ProductionConfig {
  const environment = process.env.NODE_ENV || 'development';
  // Priority: RAILWAY_PUBLIC_DOMAIN > APP_URL > localhost
  const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL || 'localhost:3000';
  const isLocalhost = appUrl.includes('localhost');
  
  return {
    app: {
      url: appUrl,
      environment: environment as 'development' | 'staging' | 'production',
      websocketProtocol: isLocalhost ? 'ws' : 'wss',
    },
    voice: {
      enabled: process.env.VOICE_AI_ENABLED === 'true',
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF',
      fallbackToGoogle: environment === 'development',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      webhookUrl: `https://${appUrl}/api/twilio/voice`,
      mediaStreamUrl: `${isLocalhost ? 'ws' : 'wss'}://${appUrl}/api/twilio/media-stream`,
    },
    monitoring: {
      enableDetailedLogging: environment !== 'production',
      enablePerformanceTracking: true,
      enableErrorReporting: environment === 'production',
    },
    performance: {
      maxConcurrentCalls: environment === 'production' ? 50 : 10,
      audioBufferSize: 64000, // 4 seconds at 8kHz
      responseTimeoutMs: 5000, // 5 second timeout
      maxCallDurationMs: 600000, // 10 minutes max call
    },
  };
}

/**
 * Get WebSocket URL for current environment
 */
export function getWebSocketUrl(prompt?: string): string {
  const config = getProductionConfig();
  const baseUrl = config.twilio.mediaStreamUrl;
  
  if (prompt) {
    return `${baseUrl}?prompt=${encodeURIComponent(prompt)}`;
  }
  
  return baseUrl;
}

/**
 * Get webhook URL for current environment
 */
export function getWebhookUrl(): string {
  const config = getProductionConfig();
  return config.twilio.webhookUrl;
}

/**
 * Validate production configuration
 */
export function validateProductionConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const config = getProductionConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables
  if (!process.env.ELEVENLABS_API_KEY) {
    errors.push('ELEVENLABS_API_KEY is required');
  }
  
  if (!config.twilio.accountSid) {
    errors.push('TWILIO_ACCOUNT_SID is required');
  }
  
  if (!config.twilio.authToken) {
    errors.push('TWILIO_AUTH_TOKEN is required');
  }

  // Production-specific validations
  if (config.app.environment === 'production') {
    if (config.app.url.includes('localhost')) {
      errors.push('Production environment cannot use localhost URLs');
    }
    
    if (!config.app.url.includes('https')) {
      warnings.push('Production should use HTTPS URLs');
    }
    
    if (config.voice.fallbackToGoogle) {
      warnings.push('Production should not fallback to Google TTS');
    }
  }

  // Voice AI validations
  if (config.voice.enabled) {
    if (!config.voice.elevenLabsVoiceId) {
      warnings.push('ELEVENLABS_VOICE_ID not set, using default voice');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log production configuration (safe for logs)
 */
export function logProductionConfig(): void {
  const config = getProductionConfig();
  const validation = validateProductionConfig();
  
  console.log('🚀 Production Configuration:');
  console.log('============================');
  console.log(`Environment: ${config.app.environment}`);
  console.log(`App URL: ${config.app.url}`);
  console.log(`WebSocket Protocol: ${config.app.websocketProtocol}`);
  console.log(`Voice AI Enabled: ${config.voice.enabled}`);
  console.log(`ElevenLabs Voice: ${config.voice.elevenLabsVoiceId}`);
  console.log(`Max Concurrent Calls: ${config.performance.maxConcurrentCalls}`);
  
  if (validation.errors.length > 0) {
    console.error('❌ Configuration Errors:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Configuration Warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  if (validation.isValid) {
    console.log('✅ Configuration is valid for deployment');
  }
}
