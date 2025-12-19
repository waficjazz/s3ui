/**
 * API Route: DELETE /api/s3/delete
 * Deletes an object from S3 bucket
 * Checks RBAC permissions (skipped for admins)
 * Query params:
 *   - bucket: string (required)
 *   - key: string (required, object key)
 *   OR
 *   - bucket: string (required)
 *   - keys: string[] (required, array of keys to delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { deleteObject, deleteObjects } from '@/lib/s3-client';
import { hasPermission } from '@/lib/rbac';
import { authOptions } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);

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

    // If not admin and no permissions, deny access
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
    const key = searchParams.get('key');
    const keysParam = searchParams.get('keys');

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

    // Handle single file deletion
    if (key) {
      // Check RBAC permissions (skip for admins)
      if (!admin) {
        if (!hasPermission(userPermissions, bucket, key, 'WRITE')) {
          console.log(`[RBAC] User denied WRITE access to ${bucket}/${key}`);
          return NextResponse.json(
            {
              success: false,
              error: 'FORBIDDEN',
              message: `No WRITE access to ${bucket}/${key}`,
            },
            { status: 403 }
          );
        }
        console.log(`[RBAC] User granted WRITE access to ${bucket}/${key}`);
      } else {
        console.log(`[Admin] Bypassing permission checks for admin user`);
      }

      await deleteObject(bucket, key);

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${key}`,
      });
    }

    // Handle multiple files deletion
    if (keysParam) {
      try {
        const keys = JSON.parse(keysParam);
        if (!Array.isArray(keys)) {
          throw new Error('Keys must be an array');
        }

        // Check RBAC permissions for all keys (skip for admins)
        if (!admin) {
          for (const k of keys) {
            if (!hasPermission(userPermissions, bucket, k, 'WRITE')) {
              console.log(`[RBAC] User denied WRITE access to ${bucket}/${k}`);
              return NextResponse.json(
                {
                  success: false,
                  error: 'FORBIDDEN',
                  message: `No WRITE access to ${bucket}/${k}`,
                },
                { status: 403 }
              );
            }
          }
          console.log(`[RBAC] User granted WRITE access to all files`);
        } else {
          console.log(`[Admin] Bypassing permission checks for admin user`);
        }

        await deleteObjects(bucket, keys);

        return NextResponse.json({
          success: true,
          message: `Successfully deleted ${keys.length} file(s)`,
        });
      } catch (parseError) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_KEYS_FORMAT',
            message: 'Keys parameter must be a valid JSON array',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'MISSING_KEY',
        message: 'Either key or keys parameter is required',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting from S3:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete file(s)';

    return NextResponse.json(
      {
        success: false,
        error: 'DELETE_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
