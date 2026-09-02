'use client';

import { useEffect } from 'react';
import { LOGIN_JUST_SUCCEEDED_COOKIE } from '@/lib/auth/return-to';
import { readCookie, deleteCookie } from '@/lib/auth/browser-cookies';
import { isLoginMethod, trackLoginSucceeded } from '@/lib/analytics';

/**
 * Reports login_succeeded for logins that finished on the server.
 * The callback routes set a one-minute cookie with the login method.
 * This reads it on the next page load, reports once, and clears it.
 * Clearing first makes a second mount a no-op.
 */
export default function LoginSuccessTracker() {
  useEffect(() => {
    const method = readCookie(LOGIN_JUST_SUCCEEDED_COOKIE);
    if (method === null) return;
    deleteCookie(LOGIN_JUST_SUCCEEDED_COOKIE);
    if (isLoginMethod(method)) {
      trackLoginSucceeded(method, window.location.pathname);
    }
  }, []);

  return null;
}
