import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig<D = any> {
    skipAuth?: boolean;
    skipReauthRedirect?: boolean;
  }

  interface InternalAxiosRequestConfig<D = any> {
    skipAuth?: boolean;
    skipReauthRedirect?: boolean;
  }
}

export type AuthAwareRequestConfig = AxiosRequestConfig;

export const publicRequestConfig: AuthAwareRequestConfig = {
  skipAuth: true,
  skipReauthRedirect: true,
};

export function getRequestAuthMode(
  config?: AuthAwareRequestConfig | InternalAxiosRequestConfig,
) {
  return {
    attachToken: config?.skipAuth !== true,
    redirectOn401: config?.skipReauthRedirect !== true,
  };
}
