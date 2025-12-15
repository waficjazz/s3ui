/**
 * API Route: DELETE /api/s3/delete
 * Deletes an object from S3 bucket
 * Query params:
 *   - bucket: string (required)
 *   - key: string (required, object key)
 *   OR
 *   - bucket: string (required)
 *   - keys: string[] (required, array of keys to delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteObject, deleteObjects } from '@/lib/s3-client';
import { ApiResponse } from '@/lib/types';

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
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
