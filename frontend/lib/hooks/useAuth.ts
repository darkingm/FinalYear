'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { clearSessionAccessToken, setSessionAccessToken } from '@/lib/auth/session-token-manager';
import { logAuthEvent } from '@/lib/auth/auth-log';

export function useAuth() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      // Sync session token to localStorage for apiClient interceptor
      localStorage.setItem('auth_token', session.accessToken as string);
      setSessionAccessToken(session.accessToken as string);
    } else if (status === 'unauthenticated') {
      // Clear stale token on logout — prevents 401 loops
      localStorage.removeItem('auth_token');
      clearSessionAccessToken();
    }
  }, [session, status]);

  // Refresh token expiry means the session is no longer usable for protected APIs,
  // but we do not hard-sign-out immediately. We clear local access state and let
  // guarded pages redirect to re-auth with the current callback URL.
  useEffect(() => {
    if ((session as any)?.error === 'RefreshTokenExpired') {
      localStorage.removeItem('auth_token');
      clearSessionAccessToken();
      logAuthEvent('session_reauth_required', {
        eventSource: 'useAuth',
        reasonCode: 'refresh_token_expired',
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    }
  }, [session]);

  return {
    user: session?.user,
    session,
    status,
    accessToken: session?.accessToken as string | undefined,
    isAuthenticated: status === 'authenticated' && !(session as any)?.error,
    isLoading: status === 'loading',
    reauthRequired: (session as any)?.error === 'RefreshTokenExpired',
  };
}
