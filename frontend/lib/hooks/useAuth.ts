'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { clearSessionAccessToken, setSessionAccessToken } from '@/lib/auth/session-token-manager';

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

  // Auto sign-out when refresh token expires / is rejected by backend
  // This happens when JWT_REFRESH_SECRET changes or session is too old
  useEffect(() => {
    if ((session as any)?.error === 'RefreshTokenExpired') {
      localStorage.removeItem('auth_token');
      clearSessionAccessToken();
      signOut({ callbackUrl: '/login?reason=session_expired' });
    }
  }, [session]);

  return {
    user: session?.user,
    session,
    status,
    accessToken: session?.accessToken as string | undefined,
    isAuthenticated: status === 'authenticated' && !(session as any)?.error,
    isLoading: status === 'loading',
  };
}
