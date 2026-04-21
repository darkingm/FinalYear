'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { clearSessionAccessToken, setSessionAccessToken } from '@/lib/auth/session-token-manager';
import { logAuthEvent } from '@/lib/auth/auth-log';
import { toast } from 'sonner';

export function useAuth() {
  const { data: session, status } = useSession();
  const signingOut = useRef(false);

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

  // When refresh token is expired, the session cookie is useless (zombie cookie).
  // Auto sign-out to clear it — otherwise every page load retries the failed refresh
  // and the user can never reach a clean login state without manually clearing cookies.
  useEffect(() => {
    if ((session as any)?.error === 'RefreshTokenExpired' && !signingOut.current) {
      signingOut.current = true;
      localStorage.removeItem('auth_token');
      clearSessionAccessToken();
      logAuthEvent('session_auto_signout', {
        eventSource: 'useAuth',
        reasonCode: 'refresh_token_expired',
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
      toast.info('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      // signOut clears the NextAuth session cookie, then redirects to login
      signOut({ callbackUrl: '/login?reason=session_expired', redirect: true });
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
