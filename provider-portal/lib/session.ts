/**
 * Session Management with iron-session
 */

import { SessionOptions } from 'iron-session';

export interface SessionData {
  user?: {
    id: string;
    email: string;
    firstName: string;
    providerId: string;
  };
  isLoggedIn: boolean;
}

// Helper function to get and validate session secret
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  
  // Only validate during runtime (when not building)
  if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!secret || secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long');
    }
  }
  
  // Return a placeholder during build, actual secret at runtime
  return secret || 'build-time-placeholder-do-not-use-in-production-min-32-chars';
}

export const sessionOptions: SessionOptions = {
  password: getSessionSecret(),
  cookieName: 'provider-portal-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: 'lax',
  },
};






