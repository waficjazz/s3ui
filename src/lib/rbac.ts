/**
 * RBAC Permission Management
 * Handles fetching and formatting user permissions from database
 */

import { prisma } from './prisma';
import { BucketPermission } from './types';

/**
 * Check if user is part of a group with admin privileges
 * Queries the database to find if any of the user's groups has isAdmin: true
 * 
 * @param groups - Array of group names the user belongs to
 * @returns boolean - true if user is in at least one admin group, false otherwise
 */
export async function isUserAdmin(groups: string[]): Promise<boolean> {
  if (!groups || groups.length === 0) {
    console.log('[RBAC] isUserAdmin: No groups provided');
    return false;
  }

  try {
    console.log(`[RBAC] Checking admin status for groups: ${JSON.stringify(groups)}`);

    // Query for any group with isAdmin=true that matches user's groups
    const adminGroup = await prisma.rbacGroup.findFirst({
      where: {
        groupName: {
          in: groups,
        },
        isAdmin: true,
      },
    });

    const hasAdmin = !!adminGroup;
    console.log(`[RBAC] User admin status: ${hasAdmin}`);
    return hasAdmin;
  } catch (error) {
    console.error('[RBAC] Error checking admin status:', error);
    return false;
  }
}

/**
 * Get all access rules for given groups
 * Optimized query using many-to-many relational join
 */
export async function getUserPermissions(groups: string[]) {
  if (!groups || groups.length === 0) {
    console.log('[RBAC] getUserPermissions: No groups provided');
    return [];
  }

  try {
    console.log(`[RBAC] Querying rules for groups: ${JSON.stringify(groups)}`);
    
    // Query rules through the many-to-many relationship
    const rules  = await (prisma.rbacAccessRule.findMany  ) ({
      where: {
        groups: {
          some: {
            group: {
              groupName: {
                in: groups,
              },
            },
          },
        },
      },
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
      orderBy: [{ bucketName: 'asc' }, { path: 'asc' }],
    });

    console.log(`[RBAC] Query returned ${rules.length} rules`);
    rules.forEach((rule: any) => {
      const groupNames = rule.groups.map((rg: any) => rg.group.groupName).join(', ');
      console.log(`[RBAC] - ${rule.bucketName}/${rule.path || '/'}: ${rule.accessType} (groups: ${groupNames})`);
    });

    return rules;
  } catch (error) {
    console.error('[RBAC] Error fetching user permissions:', error);
    return [];
  }
}

/**
 * Format permission rules into a hashable object
 * Format: { "bucket/path": "ACCESS_TYPE", ... }
 */
export function formatPermissions(rules: any[]) : Record<string, BucketPermission>{
  return rules.reduce((acc: Record<string, BucketPermission>, rule) => {
    const key = `${rule.bucketName}${rule.path ? `/${rule.path}` : ''}`;
    acc[key] = {
      accessType: rule.accessType,
      includeSubfolders: rule.includeSubfolders,
    };
    return acc;
  }, {});
}

/**
 * Create a hash of permissions for comparing changes
 */
export function getPermissionsHash(permissions: Record<string, BucketPermission>): string {
  return JSON.stringify(permissions);
}

/**
 * Check if user has any access to a bucket (for listing root)
 * Returns true if user has access to bucket root or any subdirectory
 */
export function hasBucketAccess(
  permissions: Record<string, BucketPermission>,
  bucket: string
): boolean {
  if (!permissions) {
    return false;
  }

  // Check all permission keys for this bucket
  for (const key in permissions) {
    if (key.startsWith(bucket)) {
      // User has some access to this bucket
      return true;
    }
  }

  return false;
}

/**
 * Check if user has access to ANY child paths under a given path
 * This determines if a folder should be visible to the user
 * Returns the most permissive access type found in any child path
 */
export function hasAccessToChildPaths(
  permissions: Record<string, BucketPermission>,
  bucket: string,
  path: string
): 'READ' | 'WRITE' | null {
  if (!permissions) {
    return null;
  }

  console.log("checking child paths against permissions:", permissions);

  // Normalize path - ensure it ends with / for prefix matching
  let normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!normalizedPath.endsWith('/')) {
    normalizedPath += '/';
  }
  
  const searchPrefix = `${bucket}${normalizedPath}`;
  console.log("searching for child paths with prefix:", searchPrefix);
  let maxAccess: 'READ' | 'WRITE' | null = null;

  // Check all permissions to find any that are children of this path
  for (const key in permissions) {
    // Check if this permission is a child of our search path
    if (key.startsWith(searchPrefix)) {
      const perm = permissions[key];
      // Set maxAccess if we don't have one yet, or if we find WRITE (more permissive)
      if (!maxAccess || perm.accessType === 'WRITE') {
        maxAccess = perm.accessType as 'READ' | 'WRITE';
      }
      if (maxAccess === 'WRITE') {
        // Can't get more permissive than WRITE, exit early
        break;
      }
    }
  }

  return maxAccess;
}

/**
 * Check if user has access to a specific bucket/path with required access type
 * Access types:
 * - READ: Read-only access
 * - WRITE: Write access (includes read)
 *
 * This checks in this order:
 * 1. Exact path match
 * 2. Parent paths with includeSubfolders=true
 * 3. Child paths (for displaying parent folders)
 */
export function hasPermission(
  permissions: Record<string, BucketPermission>,
  bucket: string,
  path: string,
  requiredAccess: 'READ' | 'WRITE'
): boolean {
  if (!permissions) {
    return false;
  }

  console.log("checking against permissions:", permissions);

  // Normalize path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Check exact path match
  const key = `${bucket}${normalizedPath}`;
  // remove trailing slash 
  const normalizedKey = key.endsWith('/') && key.length > 1 ? key.slice(0, -1) : key;
  if (permissions[normalizedKey]) {
    return checkAccessType(permissions[normalizedKey].accessType, requiredAccess);
  }
  // Check parent paths with includeSubfolders
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  // Check all parent paths from deepest to shallowest, including the current path itself
  for (let i = pathSegments.length; i >= 0; i--) {
    const parentPath = i === 0 ? '/' : `/${pathSegments.slice(0, i).join('/')}`;
    const parentKey = `${bucket}${parentPath}`;
    console.log("checking parent key:", parentKey);
    
    // Check both with and without trailing slash
    if (permissions[parentKey] && permissions[parentKey].includeSubfolders) {
      return checkAccessType(permissions[parentKey].accessType, requiredAccess);
    }
    const parentKeyWithSlash = parentKey.endsWith('/') ? parentKey : `${parentKey}/`;
    if (permissions[parentKeyWithSlash] && permissions[parentKeyWithSlash].includeSubfolders) {
      return checkAccessType(permissions[parentKeyWithSlash].accessType, requiredAccess);
    }
  }

  // Check if user has access to any CHILD paths
  // This allows showing parent folders when user has access to subfolders
  const childAccess = hasAccessToChildPaths(permissions, bucket, normalizedPath);
  if (childAccess) {
    console.log(`[RBAC] User has access to child paths: ${childAccess}`);
    return checkAccessType(childAccess, requiredAccess);
  }

  // Check bucket root
  const rootKey = `${bucket}`;
  if (permissions[rootKey]) {
    return checkAccessType(permissions[rootKey].accessType, requiredAccess);
  }

  return false;
}

/**
 * Check if access type satisfies required access
 * Logic:
 * - WRITE access includes READ (can't write without reading)
 * - READ access is just read-only
 */
function checkAccessType(
  userAccess: string,
  requiredAccess: 'READ' | 'WRITE'
): boolean {
  // WRITE access includes READ capability
  if (userAccess === 'WRITE') {
    return true; // Can do anything (read or write)
  }

  // READ access only allows reading
  if (requiredAccess === 'READ' && userAccess === 'READ') {
    return true;
  }

  return false;
}

/**
 * Refresh permissions for user (check if changed in DB)
 */
export async function refreshUserPermissions(
  groups: string[],
  oldHash: string
): Promise<{ permissions: Record<string, BucketPermission>; hash: string; changed: boolean }> {
  const rules = await getUserPermissions(groups);
  const permissions = formatPermissions(rules);
  const newHash = getPermissionsHash(permissions);
  const changed = oldHash !== newHash;

  return {
    permissions,
    hash: newHash,
    changed,
  };
}

export default {
  getUserPermissions,
  formatPermissions,
  getPermissionsHash,
  hasPermission,
  refreshUserPermissions,
  isUserAdmin,
};
