import jwt from 'jsonwebtoken';

export function getRefreshTokenErrorMessage(error: unknown) {
  if (error instanceof jwt.TokenExpiredError) {
    return 'Refresh token expired';
  }

  if (error instanceof jwt.NotBeforeError) {
    return 'Refresh token not active yet';
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return 'Refresh token signature invalid';
  }

  if (error instanceof Error && error.message === 'Refresh token revoked') {
    return 'Refresh token revoked';
  }

  return 'Invalid refresh token';
}
