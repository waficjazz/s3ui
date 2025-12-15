/**
 * API Route: GET /api/s3/browse
 * Lists contents of an S3 bucket with optional prefix (folder path)
 * Query params:
 *   - bucket: string (required)
 *   - prefix: string (optional, for folder)
 *   - maxKeys: number (optional, default 1000)
 *   - continuationToken: string (optional, for pagination)
 */

import { NextRequest, NextResponse } from 'next/server';
import { listObjects } from '@/lib/s3-client';
import { ApiResponse, BrowseResponse } from '@/lib/types';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<BrowseResponse>>> {
  try {
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

    // List objects from S3
    const result = await listObjects(bucket, prefix, maxKeys, continuationToken);

    return NextResponse.json({
      success: true,
      data: {
        objects: result.objects,
        commonPrefixes: result.commonPrefixes,
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
