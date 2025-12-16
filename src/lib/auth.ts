/**
 * NextAuth Configuration
 * Keycloak OIDC Provider Integration
 */

import type { NextAuthOptions } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { JWT } from 'next-auth/jwt';
import { Session } from 'next-auth';

interface CustomJWT extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface CustomSession extends Session {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string;
    preferred_username?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID || '',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
      issuer: process.env.KEYCLOAK_URL
        ? `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`
        : '',
      checks: ['pkce'], // Use PKCE for better security in OAuth2 flow
    }),
  ],

  // Custom pages
  pages: {
    error: '/auth/error',
  },

  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },

  // JWT configuration
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Callbacks
  callbacks: {
    // Called when JWT is created or updated
    async jwt({ token, account }): Promise<CustomJWT> {
      const customToken = token as CustomJWT;
      
      if (account) {
        // Store tokens when user first signs in
        customToken.accessToken = account.access_token;
        customToken.refreshToken = account.refresh_token;
        customToken.expiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
        return customToken;
      }

      // Check if token has expired
      if (!customToken.expiresAt || Date.now() < customToken.expiresAt) {
        // Token is still valid
        return customToken;
      }

      // Token has expired, try to refresh
      if (customToken.refreshToken) {
        try {
          const response = await fetch(
            `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: process.env.KEYCLOAK_CLIENT_ID || '',
                client_secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
                grant_type: 'refresh_token',
                refresh_token: customToken.refreshToken,
              }),
            }
          );

          const refreshedTokens = await response.json();

          if (!response.ok) throw refreshedTokens;

          customToken.accessToken = refreshedTokens.access_token;
          customToken.refreshToken = refreshedTokens.refresh_token ?? customToken.refreshToken;
          customToken.expiresAt = refreshedTokens.expires_in ? Date.now() + refreshedTokens.expires_in * 1000 : undefined;
          
          return customToken;
        } catch (error) {
          console.error('Token refresh failed:', error);
          customToken.error = 'RefreshAccessTokenError';
          return customToken;
        }
      }

      return customToken;
    },

    // Called when session is accessed
    async session({ session, token }): Promise<CustomSession> {
      const customSession: CustomSession = session;
      
      if (token) {
        customSession.user = {
          ...(session.user || {}),
          id: token.sub,
          preferred_username: (token as any).preferred_username,
        } as CustomSession['user'];
        customSession.accessToken = (token as CustomJWT).accessToken;
        customSession.refreshToken = (token as CustomJWT).refreshToken;
        customSession.expiresAt = (token as CustomJWT).expiresAt;
      }

      return customSession;
    },

    // Called when user is redirected after signin
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  // Events
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User signed in: ${user?.email}`);
    },
    async signOut({ token }) {
      console.log(`User signed out`);
    },
  },

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',
};
