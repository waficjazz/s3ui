/**
 * NextAuth Middleware
 * Protects routes and triggers authentication flow
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const middleware = withAuth(
  function middleware(request: NextRequest) {
    // User is authenticated, allow access
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        // `/api/auth` routes are always accessible
        if (req.nextUrl.pathname.startsWith('/api/auth')) {
          return true;
        }

        // Root `/` and `/browse` routes require authentication
        if (req.nextUrl.pathname === '/' || req.nextUrl.pathname.startsWith('/browse')) {
          return !!token;
        }

        // Admin routes require authentication and admin status
        if (req.nextUrl.pathname.startsWith('/admin')) {
          return !!(token && (token as any).isAdmin === true);
        }

        // All other routes are accessible
        return true;
      },
    },
    pages: {
      error: '/auth/error',
    },
  }
);

export const config = {
  matcher: [
    // Protect root route
    '/',
    // Protect browse routes
    '/browse/:path*',
    // Protect admin routes
    '/admin/:path*',
    // Allow auth routes
    '/api/auth/:path*',
  ],
};
