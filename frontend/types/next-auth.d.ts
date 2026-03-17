import NextAuth, { DefaultSession } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      walletAddress?: string;
      role?: string;
    } & DefaultSession['user'];
    accessToken: string;
    refreshToken?: string;
  }

  interface User {
    id: string;
    accessToken?: string;
    refreshToken?: string;
    walletAddress?: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiry?: number;
    walletAddress?: string;
    role?: string;
  }
}
