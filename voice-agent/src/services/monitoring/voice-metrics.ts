/**
 * Voice metrics and monitoring for production
 * Tracks performance, errors, and usage statistics
 */

export interface VoiceMetrics {
  calls: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  voice: {
    elevenLabsRequests: number;
    elevenLabsErrors: number;
    averageLatency: number;
    audioQualityIssues: number;
  };
  conversation: {
    averagePhaseTransitions: number;
    intentRecognitionAccuracy: number;
    userSatisfactionScore: number;
    escalationRate: number;
  };
  performance: {
    averageResponseTime: number;
    peakConcurrentCalls: number;
    memoryUsage: number;
    errorRate: number;
  };
}

/**
 * Voice metrics collector
 */
export class VoiceMetricsCollector {
  private metrics: VoiceMetrics;
  private startTime: number;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
  }

  private initializeMetrics(): VoiceMetrics {
    return {
      calls: {
        total: 0,
        successful: 0,
        failed: 0,
        averageDuration: 0,
      },
      voice: {
        elevenLabsRequests: 0,
        elevenLabsErrors: 0,
        averageLatency: 0,
        audioQualityIssues: 0,
      },
      conversation: {
        averagePhaseTransitions: 0,
        intentRecognitionAccuracy: 0,
        userSatisfactionScore: 0,
        escalationRate: 0,
      },
      performance: {
        averageResponseTime: 0,
        peakConcurrentCalls: 0,
        memoryUsage: 0,
        errorRate: 0,
      },
    };
  }

  /**
   * Record call start
   */
  recordCallStart(callSid: string): void {
    this.metrics.calls.total++;
    console.log(`📞 Call started: ${callSid} (Total: ${this.metrics.calls.total})`);
  }

  /**
   * Record call completion
   */
  recordCallCompletion(callSid: string, duration: number, successful: boolean): void {
    if (successful) {
      this.metrics.calls.successful++;
    } else {
      this.metrics.calls.failed++;
    }
    
    // Update average duration
    const totalCalls = this.metrics.calls.successful + this.metrics.calls.failed;
    this.metrics.calls.averageDuration = 
      (this.metrics.calls.averageDuration * (totalCalls - 1) + duration) / totalCalls;
    
    console.log(`📴 Call completed: ${callSid} (Duration: ${duration}ms, Success: ${successful})`);
  }

  /**
   * Record ElevenLabs request
   */
  recordElevenLabsRequest(latency: number, successful: boolean): void {
    this.metrics.voice.elevenLabsRequests++;
    
    if (!successful) {
      this.metrics.voice.elevenLabsErrors++;
    }
    
    // Update average latency
    this.metrics.voice.averageLatency = 
      (this.metrics.voice.averageLatency * (this.metrics.voice.elevenLabsRequests - 1) + latency) / 
      this.metrics.voice.elevenLabsRequests;
    
    console.log(`🎙️ ElevenLabs request: ${latency}ms (Success: ${successful})`);
  }

  /**
   * Record intent recognition result
   */
  recordIntentRecognition(input: string, intent: string, confidence: number, successful: boolean): void {
    // Update intent recognition accuracy (simplified)
    const currentAccuracy = this.metrics.conversation.intentRecognitionAccuracy;
    const totalRecognitions = this.metrics.voice.elevenLabsRequests; // Approximation
    
    this.metrics.conversation.intentRecognitionAccuracy = 
      (currentAccuracy * totalRecognitions + (successful ? confidence : 0)) / (totalRecognitions + 1);
    
    console.log(`🧠 Intent recognition: "${input}" → ${intent} (${confidence}, Success: ${successful})`);
  }

  /**
   * Record performance metrics
   */
  recordPerformanceMetrics(responseTime: number, concurrentCalls: number): void {
    // Update average response time
    const totalRequests = this.metrics.calls.total;
    this.metrics.performance.averageResponseTime = 
      (this.metrics.performance.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    
    // Update peak concurrent calls
    if (concurrentCalls > this.metrics.performance.peakConcurrentCalls) {
      this.metrics.performance.peakConcurrentCalls = concurrentCalls;
    }
    
    // Update memory usage
    this.metrics.performance.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  /**
   * Get current metrics
   */
  getMetrics(): VoiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics summary for dashboard
   */
  getMetricsSummary(): {
    uptime: string;
    callsPerHour: number;
    successRate: number;
    averageLatency: number;
    intentAccuracy: number;
    status: 'healthy' | 'warning' | 'critical';
  } {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);
    const callsPerHour = this.metrics.calls.total / Math.max(uptimeHours, 1);
    const successRate = this.metrics.calls.total > 0 
      ? this.metrics.calls.successful / this.metrics.calls.total 
      : 1;
    
    // Determine system status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (successRate < 0.8 || this.metrics.voice.averageLatency > 2000) {
      status = 'critical';
    } else if (successRate < 0.9 || this.metrics.voice.averageLatency > 1000) {
      status = 'warning';
    }
    
    return {
      uptime: formatUptime(uptime),
      callsPerHour: Math.round(callsPerHour * 100) / 100,
      successRate: Math.round(successRate * 100),
      averageLatency: Math.round(this.metrics.voice.averageLatency),
      intentAccuracy: Math.round(this.metrics.conversation.intentRecognitionAccuracy * 100),
      status,
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): string {
    const summary = this.getMetricsSummary();
    const detailed = this.getMetrics();
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary,
      detailed,
    }, null, 2);
  }
}

/**
 * Format uptime duration
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Global metrics collector instance
 */
export const voiceMetrics = new VoiceMetricsCollector();

/**
 * Initialize production monitoring
 */
export function initializeProductionMonitoring(): void {
  const config = getProductionConfig();
  
  console.log('🔍 Initializing production monitoring...');
  console.log(`Environment: ${config.app.environment}`);
  console.log(`Voice AI: ${config.voice.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`ElevenLabs Voice: ${config.voice.elevenLabsVoiceId}`);
  console.log(`WebSocket URL: ${config.twilio.mediaStreamUrl}`);
  
  // Set up periodic metrics logging
  if (config.monitoring.enableDetailedLogging) {
    setInterval(() => {
      const summary = voiceMetrics.getMetricsSummary();
      console.log('📊 Metrics Summary:', summary);
    }, 60000); // Every minute
  }
  
  // Set up error rate monitoring
  setInterval(() => {
    const summary = voiceMetrics.getMetricsSummary();
    if (summary.status === 'critical') {
      console.error('🚨 CRITICAL: System performance degraded');
      console.error('Success Rate:', summary.successRate + '%');
      console.error('Latency:', summary.averageLatency + 'ms');
    }
  }, 30000); // Every 30 seconds
}

/**
 * Get production configuration
 */
function getProductionConfig() {
  // Import here to avoid circular dependency
  const appUrl = process.env.APP_URL || process.env.VERCEL_URL || 'localhost:3000';
  const environment = process.env.NODE_ENV || 'development';
  
  return {
    app: {
      url: appUrl,
      environment,
      websocketProtocol: appUrl.includes('localhost') ? 'ws' : 'wss',
    },
    voice: {
      enabled: process.env.VOICE_AI_ENABLED === 'true',
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF',
    },
    twilio: {
      mediaStreamUrl: `${appUrl.includes('localhost') ? 'ws' : 'wss'}://${appUrl}/api/twilio/media-stream`,
    },
    monitoring: {
      enableDetailedLogging: environment !== 'production',
    },
  };
}
