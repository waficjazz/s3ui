/**
 * API Route: GET /api/s3/download
 * Generates a signed download URL for an S3 object
 * Query params:
 *   - bucket: string (required)
 *   - key: string (required, object key)
 *   - expiresIn: number (optional, expiration in seconds, default 3600)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@/lib/s3-client';
import { ApiResponse } from '@/lib/types';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ url: string; expiresIn: number }>>> {
  try {
    const { searchParams } = new URL(request.url);

    const bucket = searchParams.get('bucket');
    const key = searchParams.get('key');
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10);

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

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_KEY',
          message: 'Key parameter is required',
        },
        { status: 400 }
      );
    }

    // Generate signed URL
    const url = await getDownloadUrl(bucket, key, expiresIn);

    return NextResponse.json({
      success: true,
      data: {
        url,
        expiresIn,
      },
      message: 'Download URL generated successfully',
    });
  } catch (error) {
    console.error('Error generating download URL:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to generate download URL';

    return NextResponse.json(
      {
        success: false,
        error: 'DOWNLOAD_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
