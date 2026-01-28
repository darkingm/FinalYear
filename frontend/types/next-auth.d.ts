import NextAuth, { DefaultSession } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      walletAddress?: string;
    } & DefaultSession['user'];
    accessToken: string;
  }

  interface User {
    id: string;
    accessToken?: string;
    walletAddress?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    accessToken?: string;
    walletAddress?: string;
  }
}
