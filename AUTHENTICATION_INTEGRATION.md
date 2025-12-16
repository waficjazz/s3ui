# Keycloak SSO Authentication Integration

## Overview
Complete NextAuth.js integration with Keycloak OIDC provider has been implemented. The application now supports automatic authentication flow with user display in the header.

## ✅ Completed Integration

### 1. Configuration Files

#### `src/lib/auth.ts`
- **Purpose**: NextAuth configuration with Keycloak OIDC provider
- **Features**:
  - Keycloak OIDC provider setup with PKCE flow
  - JWT-based session strategy
  - Automatic token refresh on expiration
  - Session data enrichment with user information
  - Token expiration handling (30-day max age)

#### `src/app/api/auth/[...nextauth]/route.ts`
- **Purpose**: NextAuth API route handler
- **Function**: Exports GET and POST handlers for all NextAuth functionality

#### `src/middleware.ts`
- **Purpose**: Route protection with NextAuth
- **Protected Routes**:
  - `/browse/*` - Requires authentication
  - Redirects unauthenticated users to Keycloak login
  - Public routes: `/` (landing page), `/api/auth/*` (auth endpoints)

### 2. UI Components

#### `src/components/auth/UserMenu.tsx`
- **Location**: Top-right corner of all pages
- **Features**:
  - User avatar with initials
  - Displays user name from session
  - Dropdown menu with logout button
  - Loading skeleton while session is being verified
  - Graceful handling of missing session data

### 3. Page Updates

#### `src/app/page.tsx` (Landing Page)
- Added header with logo and UserMenu
- UserMenu displays in top-right
- Improved layout with flex structure

#### `src/app/browse/[bucket]/[[...path]]/page.tsx` (Browse Page)
- Added UserMenu import
- Integrated UserMenu in header (right side)
- Positioned after bucket selector for easy access
- Maintains sticky header functionality

### 4. Environment Configuration

#### `.env.local` Keycloak Settings
```bash
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=s3-realm
KEYCLOAK_CLIENT_ID=s3-browser
KEYCLOAK_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=supersecretkeythatshouldbegeneratedrandomly123456789
```

## 🔄 Authentication Flow

```
1. Unauthenticated User
   ↓
2. Visits http://localhost:3000 or /browse
   ↓
3. Middleware detects no auth session
   ↓
4. Redirects to Keycloak login page
   ↓
5. User logs in with Keycloak credentials
   ↓
6. Redirected back to http://localhost:3000
   ↓
7. NextAuth creates JWT session
   ↓
8. UserMenu displays user icon + name in header
   ↓
9. User can navigate /browse and access S3 files
   ↓
10. Logout button in UserMenu clears session
```

## 📋 Current State

### Ready to Test
- ✅ NextAuth configuration
- ✅ Keycloak OIDC provider setup
- ✅ Route middleware protection
- ✅ UserMenu component integration
- ✅ Auto-redirect flow configured

### Prerequisites for Testing
1. **Keycloak Instance**
   - Must be running and accessible
   - Realm created: `s3-realm`
   - Client configured: `s3-browser`

2. **Environment Variables**
   - Update `KEYCLOAK_URL` with real Keycloak endpoint
   - Update `KEYCLOAK_CLIENT_ID` and `KEYCLOAK_CLIENT_SECRET`
   - `NEXTAUTH_URL` matches dev server URL (http://localhost:3000)
   - `NEXTAUTH_SECRET` should be a random string (64+ chars recommended)

3. **Keycloak Client Configuration**
   - Access Type: public or confidential
   - Valid Redirect URI: `http://localhost:3000/api/auth/callback/keycloak`
   - Root URL: `http://localhost:3000`

## 🧪 Testing Steps

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Visit Application**
   - Open http://localhost:3000 in browser
   - Should redirect to Keycloak login (if not logged in)

3. **Login with Keycloak**
   - Enter Keycloak credentials
   - Should redirect back to landing page

4. **Verify User Display**
   - Check top-right corner for user icon + name
   - Click on user menu to see logout option

5. **Test Protected Routes**
   - Navigate to `/browse/{bucket-name}`
   - Should load without additional prompts

6. **Test Logout**
   - Click logout in UserMenu
   - Should redirect to landing page
   - Visiting `/browse` should redirect to Keycloak login again

## 🔐 Security Features

- **JWT-Based Sessions**: Stateless, scalable authentication
- **Automatic Token Refresh**: Tokens refreshed automatically on expiration
- **Middleware Protection**: Unauthenticated users cannot access `/browse` routes
- **OIDC Standard**: Industry-standard OpenID Connect protocol
- **PKCE Flow**: Enhanced security for public clients

## 📝 Next Steps

### Phase 2 (Deferred)
- [ ] Add role-based access control (RBAC)
- [ ] Protect S3 API endpoints with session verification
- [ ] Add error page for auth failures (/auth/error)
- [ ] Implement token refresh UI feedback
- [ ] Add user profile page with session details

## 📁 File Structure

```
src/
├── lib/
│   └── auth.ts                          # NextAuth configuration
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts             # NextAuth API handler
│   ├── page.tsx                         # Updated landing page
│   ├── browse/
│   │   └── [bucket]/
│   │       └── [[...path]]/
│   │           └── page.tsx             # Updated browse page
│   └── middleware.ts                    # Route protection
└── components/
    └── auth/
        └── UserMenu.tsx                 # User display component
```

## 🐛 Troubleshooting

### "Redirect URI Mismatch" Error
- Ensure Keycloak client has `http://localhost:3000/api/auth/callback/keycloak` in Valid Redirect URIs

### Session Not Persisting
- Check `NEXTAUTH_SECRET` is set (should be random 64+ chars)
- Check `NEXTAUTH_URL` matches deployment URL

### UserMenu Shows Loading Indefinitely
- Verify Keycloak endpoint is accessible
- Check browser console for CORS errors
- Ensure `.env.local` variables are correctly set

### Cannot Access /browse Routes
- Check middleware.ts is in app directory (not pages directory)
- Restart dev server after .env.local changes
- Clear browser cookies and cache

## 📞 Support

For Keycloak setup questions, refer to:
- [Keycloak Admin Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [OIDC Protocol](https://openid.net/connect/)
