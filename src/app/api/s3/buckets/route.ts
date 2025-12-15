/**
 * API Route: GET /api/s3/buckets
 * Returns list of all available S3 buckets
 */

import { NextRequest, NextResponse } from 'next/server';
import { listBuckets } from '@/lib/s3-client';
import { ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const buckets = await listBuckets();

    return NextResponse.json({
      success: true,
      data: buckets.map((bucket) => ({
        name: bucket.Name,
        creationDate: bucket.CreationDate,
      })),
    });
  } catch (error) {
    console.error('Error fetching buckets:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch buckets';

    return NextResponse.json(
      {
        success: false,
        error: 'BUCKET_LIST_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
