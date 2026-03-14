'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

export function useAuth() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      // Sync session token to localStorage for apiClient interceptor
      localStorage.setItem('auth_token', session.accessToken as string);
    } else if (status === 'unauthenticated') {
      // Clear stale token on logout — prevents 401 loops
      localStorage.removeItem('auth_token');
    }
  }, [session, status]);

  return {
    user: session?.user,
    session,
    status,
    accessToken: session?.accessToken as string | undefined,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
}
