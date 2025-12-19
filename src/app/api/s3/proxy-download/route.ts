/**
 * API Route: GET /api/s3/proxy-download
 * Proxies file download from S3 to avoid CORS issues
 * Checks RBAC permissions (skipped for admins)
 * Query params:
 *   - bucket: string (required)
 *   - key: string (required, object key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getS3Client } from '@/lib/s3-client';
import { hasPermission } from '@/lib/rbac';
import { authOptions } from '@/lib/auth';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const admin = (session.user).isAdmin;
    const userPermissions = (session.user).permissions;

    // If not admin and no permissions, deny access
    if (!admin && !userPermissions) {
      return NextResponse.json(
        { error: 'No permissions found' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const bucket = searchParams.get('bucket');
    const key = searchParams.get('key');

    // Validate required parameters
    if (!bucket) {
      return NextResponse.json(
        { error: 'Bucket parameter is required' },
        { status: 400 }
      );
    }

    if (!key) {
      return NextResponse.json(
        { error: 'Key parameter is required' },
        { status: 400 }
      );
    }

    // Check RBAC permissions (skip for admins)
    if (!admin) {
      if (!hasPermission(userPermissions, bucket, key, 'READ')) {
        console.log(`[RBAC] User denied READ access to ${bucket}/${key}`);
        return NextResponse.json(
          { error: `No READ access to ${bucket}/${key}` },
          { status: 403 }
        );
      }
      console.log(`[RBAC] User granted READ access to ${bucket}/${key}`);
    } else {
      console.log(`[Admin] Bypassing permission checks for admin user`);
    }

    // Get file from S3
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    if (response.Body) {
      const reader = response.Body as any;
      
      if (reader instanceof Uint8Array) {
        chunks.push(Buffer.from(reader));
      } else if (Buffer.isBuffer(reader)) {
        chunks.push(reader);
      } else if (typeof reader === 'string') {
        chunks.push(Buffer.from(reader));
      } else if (reader[Symbol.asyncIterator]) {
        // Handle ReadableStream/async iterable
        for await (const chunk of reader) {
          chunks.push(Buffer.from(chunk));
        }
      } else if (reader.on) {
        // Handle Node.js stream
        return await new Promise((resolve, reject) => {
          reader.on('data', (chunk: any) => chunks.push(Buffer.from(chunk)));
          reader.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(
              new NextResponse(buffer, {
                status: 200,
                headers: {
                  'Content-Type': response.ContentType || 'application/octet-stream',
                  'Content-Length': buffer.length.toString(),
                  'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
                },
              })
            );
          });
          reader.on('error', reject);
        });
      }
    }

    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      },
    });
  } catch (error) {
    console.error('Error proxying download:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to download file';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
