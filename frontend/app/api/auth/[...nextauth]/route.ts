import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';
import { logAuthEvent } from '@/lib/auth/auth-log';

// ─── SSR-safe API client ─────────────────────────────────────────────────────
// On server (NextAuth runs server-side), use the internal API URL.
// NEXT_PUBLIC_* env vars are available on both server and client in Next.js.
const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||          // Docker internal network
  process.env.NEXT_PUBLIC_API_URL ||        // Fallback to public URL
  'http://localhost:3001';

const serverApi = axios.create({
  baseURL: SERVER_API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(process.env.INTERNAL_SERVICE_KEY ? { 'X-Internal-Service-Key': process.env.INTERNAL_SERVICE_KEY } : {}),
  },
  timeout: 10000,
  withCredentials: false,                   // Server-to-server — no cookies needed
});

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.callback-url'
        : 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      // NOTE: Must NOT use __Host- or __Secure- prefix on csrf token
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const response = await serverApi.post('/api/auth/login', {
            email: credentials.email,
            password: credentials.password,
          });

          const data = response.data;
          if (data?.user) {
            return {
              id: String(data.user.user_id),
              email: data.user.email,
              name: data.user.username || data.user.email,
              image: data.user.avatar_url,
              role: data.user.role,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken, // backend now returns this in body
            };
          }
          return null;
        } catch (error: any) {
          const msg = error.response?.data?.message || 'Login failed';
          const status = error.response?.status;
          // Propagate specific errors to login page via NextAuth error query param
          if (status === 429) throw new Error('TOO_MANY_REQUESTS');
          if (status === 401) throw new Error('INVALID_CREDENTIALS');
          if (status === 403) throw new Error('ACCOUNT_SUSPENDED');
          throw new Error(msg);
        }
      },
    }),
    CredentialsProvider({
      id: 'wallet',
      name: 'Wallet',
      credentials: {
        address: { label: 'Wallet Address', type: 'text' },
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.address || !credentials?.message || !credentials?.signature) return null;
        try {
          const response = await serverApi.post('/api/auth/wallet-login', {
            wallet_address: credentials.address,
            message: credentials.message,
            signature: credentials.signature,
          });

          const data = response.data;
          if (data?.user) {
            return {
              id: String(data.user.user_id),
              email: data.user.email,
              name: data.user.username || credentials.address,
              role: data.user.role,
              walletAddress: credentials.address,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken, // backend now returns this in body
            };
          }
          return null;
        } catch (error: any) {
          const status = error.response?.status;
          if (status === 401) throw new Error('INVALID_SIGNATURE');
          throw new Error(error.response?.data?.message || 'Wallet login failed');
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'facebook') {
        try {
          const body = {
            provider: account.provider,
            providerId: account.providerAccountId ?? '',
            email: user.email ?? '',
            name: user.name ?? null,
            image: user.image ?? null,
          };
          const response = await serverApi.post('/api/auth/oauth', body);

          if (response.data?.accessToken) {
            user.accessToken = response.data.accessToken;
            user.refreshToken = response.data.refreshToken; // from body
            user.id = String(response.data.user.user_id);
            user.role = response.data.user.role;
          }
        } catch (error: any) {
          console.error('OAuth signIn error:', error.response?.data || error.message);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // First sign-in: store tokens and expiry from the backend
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.id = user.id;
        token.role = (user as any).role;
        token.walletAddress = (user as any).walletAddress;
        // Decode expiry from the JWT payload (backend default: 24h = 86400s)
        try {
          const decoded: any = JSON.parse(
            Buffer.from(((user as any).accessToken || '').split('.')[1] || 'e30=', 'base64').toString()
          );
          token.accessTokenExpiry = (decoded.exp ?? 0) * 1000;
        } catch { token.accessTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; }
      }

      // Proactive refresh: if the accessToken expires within the next 5 minutes, refresh it now
      const expiresAt = (token.accessTokenExpiry as number) || 0;
      const shouldRefresh = expiresAt - Date.now() < 5 * 60 * 1000;
      if (shouldRefresh && token.refreshToken) {
        try {
          const res = await serverApi.post('/api/auth/refresh', {
            refreshToken: token.refreshToken, // send in body (server-to-server, no cookies)
          });
          if (res.data?.accessToken) {
            token.accessToken = res.data.accessToken;
            // update refreshToken if server rotated it
            token.refreshToken = res.data.refreshToken ?? token.refreshToken;
            try {
              const decoded: any = JSON.parse(
                Buffer.from(res.data.accessToken.split('.')[1] || 'e30=', 'base64').toString()
              );
              token.accessTokenExpiry = (decoded.exp ?? 0) * 1000;
            } catch { token.accessTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; }
          }
        } catch (err: any) {
          // Refresh failed (expired / rotated / server restarted with different JWT secret).
          // Mark token as expired so the client gets a proper "sign in again" instead of
          // an infinite 401 loop. The session callback will see refreshError and return null.
          logAuthEvent('session_refresh_rejected', {
            eventSource: 'nextauth-jwt',
            reasonCode: 'backend_refresh_rejected',
            statusCode: err?.response?.status ?? null,
          });
          token.refreshError = true;
          token.accessToken = undefined;
          token.refreshToken = undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If refresh failed, return an empty session so client shows login page
      if ((token as any).refreshError) {
        return { ...session, user: undefined as any, accessToken: undefined, error: 'RefreshTokenExpired' };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.walletAddress = token.walletAddress as string;
        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
