/**
 * Authentication utilities
 */

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData, sessionOptions } from './session';
import { findUserByEmail, getProviderIdFromUser } from './airtable';

/**
 * Get current session
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email: string, password: string) {
  try {
    const user = await findUserByEmail(email);
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Check password (plain text comparison as per requirements)
    if (user.fields.Pass !== password) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // Get provider ID
    const providerId = getProviderIdFromUser(user);
    
    if (!providerId) {
      return { success: false, error: 'User is not associated with a provider' };
    }
    
    // Extract and validate user fields
    const userEmail = user.fields.Email as string;
    const userFirstName = (user.fields['First Name'] as string) || 'User';
    
    // Return user data
    return {
      success: true,
      user: {
        id: user.id,
        email: userEmail,
        firstName: userFirstName,
        providerId,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed. Please try again.' };
  }
}

/**
 * Create session for user
 */
export async function createSession(userData: {
  id: string;
  email: string;
  firstName: string;
  providerId: string;
}) {
  const session = await getSession();
  
  session.user = userData;
  session.isLoggedIn = true;
  
  await session.save();
}

/**
 * Destroy current session
 */
export async function destroySession() {
  const session = await getSession();
  session.destroy();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getSession();
  return session.isLoggedIn === true && !!session.user;
}

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session.user;
}








