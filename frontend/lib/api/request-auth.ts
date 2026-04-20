export type AuthAwareRequestConfig = {
  skipAuth?: boolean;
  skipReauthRedirect?: boolean;
};

export const publicRequestConfig: AuthAwareRequestConfig = {
  skipAuth: true,
  skipReauthRedirect: true,
};

export function getRequestAuthMode(config?: AuthAwareRequestConfig) {
  return {
    attachToken: config?.skipAuth !== true,
    redirectOn401: config?.skipReauthRedirect !== true,
  };
}
