import { describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig } from 'axios';
import { getRequestAuthMode, publicRequestConfig } from '@/lib/api/request-auth';

describe('request auth mode', () => {
  it('stays assignable to axios request config', () => {
    const config: AxiosRequestConfig = publicRequestConfig;
    expect(config.skipAuth).toBe(true);
    expect(config.skipReauthRedirect).toBe(true);
  });

  it('treats public requests as skip-auth and skip-redirect', () => {
    expect(getRequestAuthMode(publicRequestConfig)).toEqual({
      attachToken: false,
      redirectOn401: false,
    });
  });

  it('keeps authenticated defaults for regular requests', () => {
    expect(getRequestAuthMode()).toEqual({
      attachToken: true,
      redirectOn401: true,
    });
  });
});
