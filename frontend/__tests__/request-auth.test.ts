import { describe, expect, it } from '@jest/globals';
import { getRequestAuthMode, publicRequestConfig } from '@/lib/api/request-auth';

describe('request auth mode', () => {
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
