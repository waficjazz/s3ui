# Keycloak SSO Integration Plan for S3 Browser

## Overview
Integrate OpenID Connect (OIDC) authentication using Keycloak to secure the S3 Browser application with SSO capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Browser                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              S3 Browser (Next.js)                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 1. next-auth.js (Authentication)                  │  │
│  │ 2. Keycloak Provider Configuration                │  │
│  │ 3. Session Management                             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐        ┌──────────────────┐
│   Keycloak       │        │   S3 Server      │
│   (Auth Server)  │        │   (Data Access)  │
└──────────────────┘        └──────────────────┘
```

---

## Phase 1: Dependencies Installation

### Required Packages
```bash
npm install next-auth@latest keycloak-js jose
npm install -D @types/next-auth
```

### Key Libraries
- **next-auth** - Authentication middleware for Next.js
- **keycloak-js** - Keycloak JavaScript adapter (optional, for direct integration)
- **jose** - JWT handling and verification

---

## Phase 2: Configuration Setup

### 2.1 Environment Variables (.env.local)
```env
# Keycloak Configuration
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=s3-realm
KEYCLOAK_CLIENT_ID=s3-browser
KEYCLOAK_CLIENT_SECRET=your-client-secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-secure-secret-here

# JWT Configuration (for token validation)
KEYCLOAK_JWT_SECRET=your-jwt-secret
```

### 2.2 Keycloak Setup Steps
1. Create Keycloak realm (s3-realm)
2. Create OIDC client (s3-browser)
3. Configure client settings:
   - Access Type: confidential
   - Valid Redirect URIs: `http://localhost:3000/api/auth/callback/keycloak`
   - Valid Post Logout Redirect URIs: `http://localhost:3000`
4. Create user roles:
   - `s3-viewer` - Read-only access
   - `s3-admin` - Full access (download, delete, upload)
5. Assign users to roles

---

## Phase 3: NextAuth Configuration

### 3.1 Create `src/lib/auth.ts`
- Configure NextAuth with Keycloak provider
- Set up OIDC provider options
- Configure JWT and session handling
- Add role-based access control (RBAC)

### 3.2 Create `src/app/api/auth/[...nextauth]/route.ts`
- NextAuth API route handler
- Keycloak provider integration
- Session callbacks
- JWT callbacks for token handling

### 3.3 Create `src/context/AuthContext.tsx`
- React context for authentication state
- `useSession` hook wrapper
- User info and roles management
- Authentication status tracking

---

## Phase 4: UI Integration

### 4.1 Protected Routes
- Create middleware to check authentication
- Redirect unauthenticated users to login
- Protect `/browse` routes

### 4.2 Login/Logout UI
- Add login button to landing page
- Add logout button to header
- Display current user info
- Show user roles/permissions

### 4.3 Components to Create
```
src/
  ├── components/
  │   ├── auth/
  │   │   ├── LoginButton.tsx
  │   │   ├── LogoutButton.tsx
  │   │   ├── UserMenu.tsx
  │   │   └── ProtectedRoute.tsx
  │   └── ...
  ├── lib/
  │   ├── auth.ts (NextAuth config)
  │   ├── authMiddleware.ts (Request validation)
  │   └── ...
  └── middleware.ts (NextAuth middleware)
```

---

## Phase 5: API Route Protection

### 5.1 Protect S3 API Endpoints
- Add authentication checks to all `/api/s3/*` routes
- Validate JWT tokens from requests
- Check user roles for specific actions:
  - `GET` (browse, search, download) - `s3-viewer` role required
  - `DELETE` (delete files) - `s3-admin` role required
  - `POST` (upload files) - `s3-admin` role required

### 5.2 Create `src/lib/authMiddleware.ts`
- JWT validation function
- Role checking function
- Session validation
- Token refresh logic

---

## Phase 6: Session & Token Management

### 6.1 JWT Token Handling
- Decode and validate JWT tokens from Keycloak
- Check token expiration
- Implement token refresh logic
- Store tokens securely in HTTP-only cookies

### 6.2 Session Persistence
- Configure session TTL (time-to-live)
- Handle session expiration
- Implement session refresh
- Logout on token expiration

---

## Phase 7: Role-Based Access Control (RBAC)

### 7.1 Role Definitions
```typescript
enum S3BrowserRole {
  VIEWER = 's3-viewer',      // Read-only access
  ADMIN = 's3-admin',        // Full access
}
```

### 7.2 Permission Matrix
| Action | s3-viewer | s3-admin |
|--------|-----------|----------|
| Browse Folders | ✅ | ✅ |
| Download Files | ✅ | ✅ |
| Search Files | ✅ | ✅ |
| Upload Files | ❌ | ✅ |
| Delete Files | ❌ | ✅ |
| View Audit Logs | ❌ | ✅ |

### 7.3 Implementation
- Hook: `useAuthContext()` to get user roles
- Middleware: Check roles before API calls
- UI: Show/hide buttons based on permissions

---

## Phase 8: Enhanced Security Features

### 8.1 Audit Logging
- Log all user actions (download, delete, upload)
- Store user info, timestamp, and action details
- Create audit log API endpoint

### 8.2 CORS & Security Headers
- Configure CORS for Keycloak domain
- Add security headers (CSP, X-Frame-Options, etc.)
- Implement CSRF protection

### 8.3 Token Validation
- Validate JWT signature
- Check token expiration
- Verify token issuer
- Check user roles in token

---

## Implementation Order

### Step 1: Basic Setup
✅ Install dependencies  
✅ Configure environment variables  
✅ Setup NextAuth with Keycloak provider  
✅ Create API routes for auth

### Step 2: UI Components
✅ Create login/logout buttons  
✅ Add user menu with profile info  
✅ Protect routes with middleware  
✅ Display authentication status

### Step 3: API Protection
✅ Add auth checks to S3 API routes  
✅ Implement role-based access control  
✅ Protect sensitive operations (delete, upload)  
✅ Add error handling for unauthorized access

### Step 4: Advanced Features
✅ Implement token refresh  
✅ Add audit logging  
✅ Setup session management  
✅ Add security headers and CORS

### Step 5: Testing & Deployment
✅ Test with different user roles  
✅ Verify protected routes  
✅ Test token expiration and refresh  
✅ Deploy to production

---

## File Structure (Post-Implementation)

```
src/
  ├── app/
  │   ├── api/
  │   │   ├── auth/
  │   │   │   └── [...nextauth]/route.ts
  │   │   └── s3/
  │   │       ├── buckets/route.ts (protected)
  │   │       ├── browse/route.ts (protected)
  │   │       ├── download/route.ts (protected)
  │   │       ├── delete/route.ts (protected - admin)
  │   │       └── upload/route.ts (protected - admin)
  │   ├── auth/
  │   │   └── login/page.tsx
  │   └── ...
  ├── components/
  │   ├── auth/
  │   │   ├── LoginButton.tsx
  │   │   ├── LogoutButton.tsx
  │   │   ├── UserMenu.tsx
  │   │   ├── ProtectedRoute.tsx
  │   │   └── RoleGuard.tsx
  │   └── ...
  ├── context/
  │   └── AuthContext.tsx
  ├── lib/
  │   ├── auth.ts
  │   ├── authMiddleware.ts
  │   ├── permissions.ts
  │   └── ...
  └── middleware.ts
```

---

## Security Considerations

✅ **JWT Validation**
- Verify token signature with Keycloak public key
- Check token expiration
- Validate issuer claim

✅ **HTTP-Only Cookies**
- Store session tokens in HTTP-only cookies (secure by default)
- Prevent XSS attacks

✅ **HTTPS Only**
- Enforce HTTPS in production
- Configure secure cookie settings

✅ **CORS Configuration**
- Allow only trusted Keycloak domains
- Restrict API access by origin

✅ **Rate Limiting**
- Implement rate limiting on auth endpoints
- Prevent brute force attacks

---

## Configuration Examples

### Keycloak URL Structure
```
https://keycloak.example.com/realms/s3-realm/protocol/openid-connect/token
https://keycloak.example.com/realms/s3-realm/protocol/openid-connect/auth
https://keycloak.example.com/realms/s3-realm/protocol/openid-connect/userinfo
```

### NextAuth Provider Configuration
```typescript
providers: [
  KeycloakProvider({
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    issuer: process.env.KEYCLOAK_ISSUER_URL,
  }),
]
```

---

## Next Steps

Would you like me to proceed with implementation? I recommend starting with:

1. **Step 1: Basic Setup** - NextAuth + Keycloak provider
2. **Step 2: Login UI** - Add login/logout buttons
3. **Step 3: Route Protection** - Middleware for authenticated routes
4. **Step 4: API Protection** - Secure S3 API endpoints
5. **Step 5: RBAC** - Role-based access control

Let me know which step you'd like to start with! 🚀
