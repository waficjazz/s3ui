/**
 * NextAuth Configuration
 * Keycloak OIDC Provider Integration with RBAC
 */

import type { NextAuthOptions } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { getUserPermissions, formatPermissions, getPermissionsHash } from './rbac';
import { CustomJWT, CustomSession } from './types';


export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID || '',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
      issuer: process.env.KEYCLOAK_URL
        ? `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`
        : '',
      authorization: { params: { scope: "openid email profile offline_access" } },
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
    async jwt({ token, account, profile }): Promise<CustomJWT> {
      const customToken = token as CustomJWT;
      
      if (account && profile) {
        // Store tokens when user first signs in
        customToken.accessToken = account.access_token;
        customToken.refreshToken = account.refresh_token;
        customToken.expiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
        
        // Extract groups from Keycloak profile or access token
        // Keycloak can store groups in the "groups" claim or "resource_access" claim
        // Try multiple possible locations
        let groups: string[] = [];
        
        // // Try from profile first
        // if ((profile).groups) {
        //   groups = (profile).groups;
        //   console.log(`[RBAC] Groups from profile: ${JSON.stringify(groups)}`);
        // }
        
        // Try from account (raw token claims)
        if (!groups || groups.length === 0) {
          if ((account)?.id_token) {
            const tokenParts = (account as any).id_token.split('.');
            if (tokenParts.length === 3) {
              try {
                const decoded = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                groups = decoded.groups || [];
                if (groups.length > 0) {
                  console.log(`[RBAC] Groups from id_token: ${JSON.stringify(groups)}`);
                }
              } catch (e) {
                console.log('[RBAC] Could not decode id_token');
              }
            }
          }
        }
        
        console.log(`[RBAC] User signin with groups: ${JSON.stringify(groups)}`);
        
        // Store groups in token for later use
        customToken.groups = groups;
        
        // Fetch and embed RBAC permissions on initial signin
        try {
          const rbacRules = await getUserPermissions(groups);
          console.log(`[RBAC] Found ${rbacRules.length} permission rules for user groups`);
          
          rbacRules.forEach((rule) => {
            console.log(
              `[RBAC] Rule: ${rule.bucketName}${rule.path || '/'} - ${rule.accessType} (subfolders: ${rule.includeSubfolders})`
            );
          });
          
          const permissions = formatPermissions(rbacRules);
          const permissionsHash = getPermissionsHash(permissions);
          
          console.log(`[RBAC] Formatted permissions: ${JSON.stringify(permissions)}`);
          
          customToken.permissions = permissions;
          customToken.permissionsHash = permissionsHash;
          customToken.permissionsRefreshedAt = Date.now();
        } catch (error) {
          console.error('[RBAC] Failed to fetch RBAC permissions:', error);
          customToken.permissions = {};
          customToken.permissionsHash = '';
          customToken.permissionsRefreshedAt = Date.now();
        }
        
        return customToken;
      }

      // Check if token has expired
      if (!customToken.expiresAt || Date.now() < customToken.expiresAt) {
        // Token is still valid, but check if permissions need refresh (every 15 minutes)
        const permRefreshInterval = 15 * 60 * 1000; // 15 minutes
        const lastRefresh = customToken.permissionsRefreshedAt || 0;
        
        if (Date.now() - lastRefresh > permRefreshInterval) {
          try {
            // Use groups stored in token from initial signin
            const groups = customToken.groups || [];
            if (groups.length > 0) {
              console.log(`[RBAC] Refreshing permissions for groups: ${JSON.stringify(groups)}`);
              
              const rbacRules = await getUserPermissions(groups);
              const permissions = formatPermissions(rbacRules);
              const newHash = getPermissionsHash(permissions);
              
              // Only update if permissions changed
              if (newHash !== customToken.permissionsHash) {
                customToken.permissions = permissions;
                customToken.permissionsHash = newHash;
                console.log(`[RBAC] ✓ Permissions updated (${rbacRules.length} rules)`);
              } else {
                console.log(`[RBAC] ✓ Permissions unchanged`);
              }
            }
            
            customToken.permissionsRefreshedAt = Date.now();
          } catch (error) {
            console.error('Failed to refresh RBAC permissions:', error);
          }
        }
        
        return customToken;
      }

      // Token has expired, try to refresh  , to fix
      if (customToken.refreshToken) {
        try {
          // Create fetch options with support for self-signed certificates in development
          const fetchOptions: RequestInit = {
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
          };

          // In development, allow self-signed certificates
        //   if (process.env.NODE_ENV === 'development') {
            // Use https module for custom agent with self-signed cert support
            const https = await import('https');
            const agent = new https.Agent({
              rejectUnauthorized: false,
            });
            (fetchOptions as any).agent = agent;
        //   }

          const response = await fetch(
            `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
            fetchOptions
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
      const customToken = token as CustomJWT;
      
      if (token) {
        // Extract groups from the stored token
        const groups = customToken.groups || [];
        
        customSession.user = {
          ...(session.user || {}),
          id: token.sub,
          preferred_username: (token as any).preferred_username,
          groups,
          permissions: customToken.permissions,
        } as CustomSession['user'];
        customSession.accessToken = customToken.accessToken;
        customSession.refreshToken = customToken.refreshToken;
        customSession.expiresAt = customToken.expiresAt;
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
