import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { getRefreshTokenErrorMessage } from '../auth.refresh-logic';

describe('getRefreshTokenErrorMessage', () => {
  it('returns a specific message for expired refresh tokens', () => {
    const error = new jwt.TokenExpiredError('jwt expired', new Date());

    expect(getRefreshTokenErrorMessage(error)).toBe('Refresh token expired');
  });

  it('returns a specific message for revoked refresh tokens', () => {
    expect(getRefreshTokenErrorMessage(new Error('Refresh token revoked'))).toBe('Refresh token revoked');
  });
});
