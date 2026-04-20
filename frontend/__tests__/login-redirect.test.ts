import { describe, expect, it } from '@jest/globals';
import { buildLoginRedirectUrl, getLoginNoticeForReason } from '@/lib/auth/login-redirect';

describe('login redirect helpers', () => {
  it('builds a callbackUrl-based login redirect', () => {
    expect(buildLoginRedirectUrl('/orders/42')).toBe('/login?callbackUrl=%2Forders%2F42');
  });

  it('preserves reauth reason when present', () => {
    expect(buildLoginRedirectUrl('/checkout/42?token=7', 'reauth_required'))
      .toBe('/login?callbackUrl=%2Fcheckout%2F42%3Ftoken%3D7&reason=reauth_required');
  });

  it('maps reauth reasons to a user-facing notice', () => {
    expect(getLoginNoticeForReason('reauth_required'))
      .toBe('Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục đúng trang bạn đang mở.');
    expect(getLoginNoticeForReason('session_expired'))
      .toBe('Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục đúng trang bạn đang mở.');
    expect(getLoginNoticeForReason('unknown')).toBeNull();
  });
});
