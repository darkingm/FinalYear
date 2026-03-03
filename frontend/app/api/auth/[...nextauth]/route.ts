import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import { apiClient } from '@/lib/api/client';

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
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const response = await apiClient.post('/api/auth/login', {
            email: credentials?.email,
            password: credentials?.password,
          });

          if (response.data && response.data.user) {
            return {
              id: response.data.user.user_id,
              email: response.data.user.email,
              name: response.data.user.username,
              image: response.data.user.avatar_url,
              role: response.data.user.role,
              accessToken: response.data.accessToken,
            };
          }
          return null;
        } catch (error) {
          console.error('Login error:', error);
          return null;
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
        try {
          const response = await apiClient.post('/api/auth/wallet-login', {
            wallet_address: credentials?.address,
            message: credentials?.message,
            signature: credentials?.signature,
          });

          if (response.data && response.data.user) {
            return {
              id: response.data.user.user_id,
              email: response.data.user.email,
              name: response.data.user.username || credentials?.address,
              role: response.data.user.role,
              walletAddress: credentials?.address,
              accessToken: response.data.accessToken,
            };
          }
          return null;
        } catch (error) {
          console.error('Wallet login error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'facebook') {
        try {
          // Build plain JSON payload (avoid undefined/circular refs that break JSON)
          const body = {
            provider: account.provider ?? '',
            providerId: account.providerAccountId ?? '',
            email: user.email ?? '',
            name: user.name ?? null,
            image: user.image ?? null,
          };
          const response = await apiClient.post('/api/auth/oauth', body);

          if (response.data && response.data.accessToken) {
            user.accessToken = response.data.accessToken;
            user.id = response.data.user.user_id;
            user.role = response.data.user.role;
          }
        } catch (error) {
          console.error('OAuth error:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.id = user.id;
        token.role = user.role;
        token.walletAddress = user.walletAddress;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.walletAddress = token.walletAddress as string;
        session.accessToken = token.accessToken as string;
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
