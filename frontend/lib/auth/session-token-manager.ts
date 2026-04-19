'use client';

import { getSession } from 'next-auth/react';

type SessionSnapshot = {
  accessToken?: string;
  error?: string;
} | null;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const TOKEN_KEY = 'auth_token';

function createBrowserStorage(): StorageLike {
  return {
    getItem(key: string) {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    },
    removeItem(key: string) {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    },
  };
}

function extractAccessToken(session: SessionSnapshot) {
  if (!session || session.error || !session.accessToken) return null;
  return session.accessToken;
}

export function createSessionTokenManager({
  getSession: readSession,
  storage,
  tokenKey = TOKEN_KEY,
}: {
  getSession: () => Promise<SessionSnapshot>;
  storage: StorageLike;
  tokenKey?: string;
}) {
  let cachedToken = storage.getItem(tokenKey);
  let inflightRefresh: Promise<string | null> | null = null;

  const setSessionToken = (token: string) => {
    cachedToken = token;
    storage.setItem(tokenKey, token);
  };

  const clearSessionToken = () => {
    cachedToken = null;
    storage.removeItem(tokenKey);
  };

  const peekToken = () => cachedToken || storage.getItem(tokenKey);

  const refreshSessionToken = async () => {
    if (inflightRefresh) {
      return inflightRefresh;
    }

    inflightRefresh = (async () => {
      const session = await readSession();
      const nextToken = extractAccessToken(session);

      if (!nextToken) {
        clearSessionToken();
        return null;
      }

      setSessionToken(nextToken);
      return nextToken;
    })().finally(() => {
      inflightRefresh = null;
    });

    return inflightRefresh;
  };

  const ensureSessionToken = async () => {
    const existing = peekToken();
    if (existing) {
      cachedToken = existing;
      return existing;
    }

    return refreshSessionToken();
  };

  return {
    peekToken,
    ensureSessionToken,
    refreshSessionToken,
    setSessionToken,
    clearSessionToken,
  };
}

const browserSessionTokenManager = createSessionTokenManager({
  getSession: async () => {
    if (typeof window === 'undefined') return null;
    return await getSession() as SessionSnapshot;
  },
  storage: createBrowserStorage(),
});

export const getStoredAccessToken = () => browserSessionTokenManager.peekToken();
export const ensureSessionAccessToken = () => browserSessionTokenManager.ensureSessionToken();
export const refreshSessionAccessToken = () => browserSessionTokenManager.refreshSessionToken();
export const setSessionAccessToken = (token: string) => browserSessionTokenManager.setSessionToken(token);
export const clearSessionAccessToken = () => browserSessionTokenManager.clearSessionToken();
