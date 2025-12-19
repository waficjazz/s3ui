/**
 * API Route: GET /api/s3/browse
 * Lists contents of an S3 bucket with optional prefix (folder path)
 * Filters results based on user RBAC permissions
 * Query params:
 *   - bucket: string (required)
 *   - prefix: string (optional, for folder)
 *   - maxKeys: number (optional, default 1000)
 *   - continuationToken: string (optional, for pagination)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { listObjects } from '@/lib/s3-client';
import { hasPermission, hasBucketAccess } from '@/lib/rbac';
import { authOptions } from '@/lib/auth';
import { ApiResponse, BrowseResponse } from '@/lib/types';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<BrowseResponse>>> {
  try {
    const session  = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
        { status: 401 }
      );
    }
    const admin = (session.user).isAdmin;
    
    const userPermissions = (session.user).permissions;
    
    // If admin, skip permission checks
    if (!admin && !userPermissions) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'No permissions found',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const bucket = searchParams.get('bucket');
    const prefix = searchParams.get('prefix') || '';
    const maxKeys = parseInt(searchParams.get('maxKeys') || '1000', 10);
    const continuationToken = searchParams.get('continuationToken') || undefined;

    // Validate required parameters
    if (!bucket) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_BUCKET',
          message: 'Bucket parameter is required',
        },
        { status: 400 }
      );
    }

    // ✅ Check RBAC permissions (skip for admins)
    if (!admin) {
      // If no prefix specified (root), check if user has access to ANY path in bucket
      // If prefix specified, check if user has access to that specific path
      const checkPath = prefix || '/';
      
      // For root path, allow if user has access to any subdirectory in the bucket
      if (!prefix || prefix === '/') {
        if (!hasBucketAccess(userPermissions, bucket)) {
          console.log(`[RBAC] User denied access to bucket ${bucket}`);
          return NextResponse.json(
            {
              success: false,
              error: 'FORBIDDEN',
              message: `No access to bucket ${bucket}`,
            },
            { status: 403 }
          );
        }
      } else {
        // For specific paths, check exact permission
        if (!hasPermission(userPermissions, bucket, checkPath, 'READ')) {
          console.log(`[RBAC] User denied READ access to ${bucket}${checkPath}`);
          return NextResponse.json(
            {
              success: false,
              error: 'FORBIDDEN',
              message: `No READ access to ${bucket}${checkPath}`,
            },
            { status: 403 }
          );
        }
      }
      console.log(`[RBAC] User granted access to ${bucket}${checkPath}`);
    } else {
      console.log(`[Admin] Bypassing permission checks for admin user`);
    }


    // ✅ List objects from S3 (one call)
    const result = await listObjects(bucket, prefix, maxKeys, continuationToken);

    // ✅ Filter objects - only return items user has permission for (skip for admins)
    const filteredObjects = admin
      ? result.objects
      : result.objects.filter((obj) => {
          const hasAccess = hasPermission(userPermissions, bucket, obj.key, 'READ');
          if (!hasAccess) {
            console.log(`[RBAC] Filtering out object: ${bucket}${obj.key}`);
          }
          return hasAccess;
        });

    // ✅ Filter prefixes (folders) - only return subfolders user has permission for (skip for admins)
    const filteredPrefixes = admin
      ? result.commonPrefixes
      : result.commonPrefixes.filter((prefix) => {
          const hasAccess = hasPermission(userPermissions, bucket, prefix.key, 'READ');
          if (!hasAccess) {
            console.log(`[RBAC] Filtering out prefix: ${bucket}/${prefix.key}`);
          }
          return hasAccess;
        });

    console.log(
      `[RBAC] Browse results: ${filteredObjects.length}/${result.objects.length} objects, ` +
      `${filteredPrefixes.length}/${result.commonPrefixes.length} prefixes`
    );

    return NextResponse.json({
      success: true,
      data: {
        objects: filteredObjects,
        commonPrefixes: filteredPrefixes,
        isTruncated: result.isTruncated,
        continuationToken: result.continuationToken,
        currentPrefix: result.currentPrefix,
        bucket: result.bucket,
      },
    });
  } catch (error) {
    console.error('Error browsing S3:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to browse S3 bucket';

    return NextResponse.json(
      {
        success: false,
        error: 'BROWSE_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
