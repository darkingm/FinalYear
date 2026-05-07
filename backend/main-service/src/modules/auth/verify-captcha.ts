import { logger } from '../../utils/logger';

export type CaptchaResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

/**
 * Verify hCaptcha token server-side.
 *
 * Behavior:
 * - Missing token → reject (400).
 * - HCAPTCHA_SECRET configured → call hCaptcha siteverify; reject on failure.
 * - HCAPTCHA_SECRET missing AND production → reject (500). Dev → allow (warn).
 *
 * Why: register and login both need this; previously only register enforced it,
 * leaving login CAPTCHA UI as decoration.
 */
export async function verifyCaptcha(
  token: string | undefined | null,
  context: { action: 'register' | 'login'; email?: string },
): Promise<CaptchaResult> {
  if (!token) {
    logger.warn(`${context.action} attempt without captcha token`, { email: context.email });
    return {
      ok: false,
      status: 400,
      code: 'ERR_CAPTCHA_REQUIRED',
      message: 'Vui lòng hoàn thành xác minh CAPTCHA',
    };
  }

  const hcaptchaSecret = process.env.HCAPTCHA_SECRET;
  if (!hcaptchaSecret || hcaptchaSecret === 'your_hcaptcha_secret') {
    if (process.env.NODE_ENV === 'production') {
      logger.error('HCAPTCHA_SECRET not configured in production!');
      return {
        ok: false,
        status: 500,
        code: 'ERR_CAPTCHA_CONFIG',
        message: 'Lỗi cấu hình server. Vui lòng liên hệ hỗ trợ.',
      };
    }
    // Dev mode without captcha config — allow with warning
    logger.warn(`${context.action} captcha skipped — HCAPTCHA_SECRET not configured (dev mode)`);
    return { ok: true };
  }

  try {
    const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${hcaptchaSecret}&response=${token}`,
    });
    const verifyData = (await verifyRes.json()) as {
      success: boolean;
      'error-codes'?: string[];
    };

    if (!verifyData.success) {
      const errorCodes = verifyData['error-codes'] || [];
      logger.warn('hCaptcha verification failed', {
        action: context.action,
        email: context.email,
        errorCodes,
        tokenLen: token?.length,
      });

      let userMessage = 'Xác minh CAPTCHA thất bại. Vui lòng thử lại.';
      if (errorCodes.includes('invalid-or-already-seen-response')) {
        userMessage = 'CAPTCHA đã hết hạn hoặc đã sử dụng. Vui lòng làm mới và thử lại.';
      } else if (errorCodes.includes('invalid-input-response')) {
        userMessage = 'CAPTCHA không hợp lệ. Vui lòng thử lại.';
      } else if (errorCodes.includes('sitekey-secret-mismatch')) {
        userMessage = 'Lỗi cấu hình CAPTCHA. Vui lòng liên hệ hỗ trợ.';
        logger.error('CRITICAL: hCaptcha sitekey-secret mismatch — check HCAPTCHA_SECRET and NEXT_PUBLIC_HCAPTCHA_SITEKEY');
      }

      return {
        ok: false,
        status: 400,
        code: 'ERR_CAPTCHA_FAILED',
        message: userMessage,
      };
    }

    return { ok: true };
  } catch (err) {
    logger.error('hCaptcha API unreachable:', err);
    return {
      ok: false,
      status: 503,
      code: 'ERR_CAPTCHA_SERVICE',
      message: 'Dịch vụ xác minh CAPTCHA tạm thời không khả dụng. Vui lòng thử lại sau.',
    };
  }
}
