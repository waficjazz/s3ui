/**
 * API Route: GET /api/s3/search
 * Searches for files in an S3 bucket matching a query string
 * Query params:
 *   - bucket: string (required)
 *   - query: string (required, search term)
 *   - maxResults: number (optional, default 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchObjects } from '@/lib/s3-client';
import { ApiResponse, SearchResult } from '@/lib/types';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<SearchResult[]>>> {
  try {
    const { searchParams } = new URL(request.url);

    const bucket = searchParams.get('bucket');
    const query = searchParams.get('query');
    const maxResults = parseInt(searchParams.get('maxResults') || '100', 10);

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

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_QUERY',
          message: 'Query parameter is required',
        },
        { status: 400 }
      );
    }

    // Search for objects
    const results = await searchObjects(bucket, query, maxResults);

    return NextResponse.json({
      success: true,
      data: results,
      message: `Found ${results.length} results`,
    });
  } catch (error) {
    console.error('Error searching S3:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to search S3 bucket';

    return NextResponse.json(
      {
        success: false,
        error: 'SEARCH_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
