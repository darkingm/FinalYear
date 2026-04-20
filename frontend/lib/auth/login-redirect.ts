export type LoginReason = 'reauth_required' | 'session_expired';

const LOGIN_NOTICE =
  'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục đúng trang bạn đang mở.';

export function buildLoginRedirectUrl(callbackUrl: string, reason?: LoginReason) {
  const params = new URLSearchParams({
    callbackUrl,
  });

  if (reason) {
    params.set('reason', reason);
  }

  return `/login?${params.toString()}`;
}

export function getLoginNoticeForReason(reason: string | null | undefined) {
  if (reason === 'reauth_required' || reason === 'session_expired') {
    return LOGIN_NOTICE;
  }

  return null;
}
