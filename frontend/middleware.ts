import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/checkout',
  '/orders',
  '/wallet',
  '/profile',
  '/cart',
  '/wishlist',
  '/addresses',
  '/notifications',
  '/disputes',
  '/admin',
];

// Routes that require seller/admin role
const SELLER_ROUTES = [
  '/seller/dashboard',
  '/products/create',
  '/coupons',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Redirect authenticated users away from auth pages
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    if (token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Check protected routes
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isSeller = SELLER_ROUTES.some((route) => pathname.startsWith(route));
  const isAdmin = pathname.startsWith('/admin');

  if ((isProtected || isSeller) && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require admin role — block non-admin users even if authenticated
  if (isAdmin && token && (token as any).role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/checkout/:path*',
    '/orders/:path*',
    '/wallet/:path*',
    '/profile/:path*',
    '/cart/:path*',
    '/wishlist/:path*',
    '/addresses/:path*',
    '/notifications/:path*',
    '/disputes/:path*',
    '/seller/:path*',
    '/products/create',
    '/coupons/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
