/**
 * API Route: GET /api/s3/search
 * Searches for files in an S3 bucket matching a query string
 * Filters results based on user RBAC permissions
 * Query params:
 *   - bucket: string (required)
 *   - query: string (required, search term)
 *   - maxResults: number (optional, default 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { searchObjects } from '@/lib/s3-client';
import { hasPermission, hasBucketAccess } from '@/lib/rbac';
import { authOptions } from '@/lib/auth';
import { ApiResponse, SearchResult } from '@/lib/types';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<SearchResult[]>>> {
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

    // Check RBAC permissions (skip for admins)
    if (!admin) {
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
      console.log(`[RBAC] User granted access to bucket ${bucket}`);
    } else {
      console.log(`[Admin] Bypassing permission checks for admin user`);
    }

    // Search for objects
    const results = await searchObjects(bucket, query, maxResults);

    // Filter results - only return items user has permission for (skip for admins)
    const filteredResults = admin
      ? results
      : results.filter((result) => {
          const hasAccess = hasPermission(userPermissions, bucket, result.key, 'READ');
          if (!hasAccess) {
            console.log(`[RBAC] Filtering out search result: ${bucket}${result.key}`);
          }
          return hasAccess;
        });

    console.log(
      `[RBAC] Search results: ${filteredResults.length}/${results.length} items`
    );

    return NextResponse.json({
      success: true,
      data: filteredResults,
      message: `Found ${filteredResults.length} results`,
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
