import { describe, expect, it, jest } from '@jest/globals';
import { createSessionTokenManager } from '@/lib/auth/session-token-manager';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

describe('createSessionTokenManager', () => {
  it('deduplicates concurrent session refresh calls', async () => {
    let resolveSession: ((value: { accessToken: string }) => void) | undefined;
    const getSession = jest.fn(() => new Promise<{ accessToken: string }>((resolve) => {
      resolveSession = resolve;
    }));
    const storage = createMemoryStorage();
    const manager = createSessionTokenManager({ getSession, storage });

    const first = manager.refreshSessionToken();
    const second = manager.refreshSessionToken();

    expect(getSession).toHaveBeenCalledTimes(1);

    resolveSession?.({ accessToken: 'fresh-token' });

    await expect(Promise.all([first, second])).resolves.toEqual(['fresh-token', 'fresh-token']);
    expect(storage.getItem('auth_token')).toBe('fresh-token');
  });

  it('reuses cached token without re-reading the session endpoint', async () => {
    const getSession = jest.fn(async () => null);
    const storage = createMemoryStorage({ auth_token: 'cached-token' });
    const manager = createSessionTokenManager({ getSession, storage });

    await expect(manager.ensureSessionToken()).resolves.toBe('cached-token');
    expect(getSession).not.toHaveBeenCalled();
  });
});
