/**
 * API Route: POST /api/s3/upload
 * Uploads a file to S3 bucket
 * Checks RBAC permissions (skipped for admins)
 * Body: FormData with file and metadata
 *   - bucket: string (required)
 *   - key: string (required, destination path)
 *   - file: File (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { uploadObject } from '@/lib/s3-client';
import { hasPermission } from '@/lib/rbac';
import { authOptions } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';

export async function POST(
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

    const formData = await request.formData();

    const bucket = formData.get('bucket') as string;
    const key = formData.get('key') as string;
    const file = formData.get('file') as File;

    // Validate required parameters
    if (!bucket) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_BUCKET',
          message: 'Bucket is required',
        },
        { status: 400 }
      );
    }

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_KEY',
          message: 'Key (destination path) is required',
        },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_FILE',
          message: 'File is required',
        },
        { status: 400 }
      );
    }

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

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Upload to S3
    await uploadObject(bucket, key, uint8Array, file.type || 'application/octet-stream');

    return NextResponse.json({
      success: true,
      data: {
        bucket,
        key,
        size: file.size,
        type: file.type,
      },
      message: `Successfully uploaded ${file.name}`,
    });
  } catch (error) {
    console.error('Error uploading to S3:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';

    return NextResponse.json(
      {
        success: false,
        error: 'UPLOAD_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Configure upload size limit (50MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
