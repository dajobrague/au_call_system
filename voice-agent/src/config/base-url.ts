/**
 * Base URL Configuration
 * Central source of truth for application URLs across all environments
 */

/**
 * Get the application's base URL
 * Priority order:
 * 1. RAILWAY_PUBLIC_DOMAIN (Railway deployment)
 * 2. BASE_URL (custom override)
 * 3. APP_URL (legacy support)
 * 4. localhost:3000 (local development)
 */
export function getBaseUrl(): string {
  // Railway deployment (primary)
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  // Custom base URL (explicit override)
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  
  // Legacy app URL
  if (process.env.APP_URL) {
    const url = process.env.APP_URL;
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }
  
  // Local development fallback
  return 'http://localhost:3000';
}

/**
 * Get WebSocket URL based on base URL
 */
export function getWebSocketUrl(): string {
  const baseUrl = getBaseUrl();
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const hostname = baseUrl.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${hostname}/stream`;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running on Railway
 */
export function isRailway(): boolean {
  return !!process.env.RAILWAY_PUBLIC_DOMAIN || !!process.env.RAILWAY_ENVIRONMENT;
}

/**
 * Check if running locally
 */
export function isLocal(): boolean {
  const baseUrl = getBaseUrl();
  return baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
}
