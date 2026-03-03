'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

export function useAuth() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.accessToken) {
      // Store token in localStorage for API client
      localStorage.setItem('auth_token', session.accessToken);
    }
  }, [session]);

  return {
    user: session?.user,
    session,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
}
