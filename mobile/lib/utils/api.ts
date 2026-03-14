/**
 * Standard error-safe API wrapper.
 * Returns { data, error } instead of throwing.
 * All services should use this pattern for consistent error handling.
 */
export async function safeCall<T>(
  fn: () => Promise<T>,
  options: {
    fallback?: T;
    onError?: (msg: string, err: unknown) => void;
    tag?: string; // for logging
  } = {},
): Promise<{ data: T | undefined; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err: any) {
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'Đã có lỗi xảy ra. Vui lòng thử lại.';

    if (__DEV__) {
      console.error(`[safeCall${options.tag ? `:${options.tag}` : ''}]`, message, err);
    }

    options.onError?.(message, err);
    return { data: options.fallback, error: message };
  }
}

/**
 * Retry wrapper — retries a function up to `maxRetries` times on failure.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Type guard to check if an API error is a 404
 */
export function is404(err: unknown): boolean {
  return (err as any)?.response?.status === 404;
}

/**
 * Type guard to check if an API error is a 401
 */
export function isUnauthorized(err: unknown): boolean {
  return (err as any)?.response?.status === 401;
}
