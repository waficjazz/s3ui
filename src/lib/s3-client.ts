/**
 * S3 Client Configuration and Utilities
 * Supports on-premises S3-compatible storage (MinIO, CloudBees, etc.)
 */

import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  HeadBucketCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import https from 'https';

// Disable SSL verification globally for development with self-signed certificates
if (process.env.S3_DISABLE_SSL_VERIFICATION === 'true') {
  https.globalAgent.options.rejectUnauthorized = false;
  // For Node.js 16+, we also need to set this
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Initialize S3 Client with on-premises configuration
const initializeS3Client = () => {
  const hostBase = process.env.S3_HOST_BASE;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION || 'us-east-1';

  if (!hostBase || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing required S3 configuration in environment variables');
  }

  // Construct the endpoint URL for on-premises S3
  // Use https:// for secure connection
  const endpoint = `http://${hostBase}`;

  console.log('S3 Client Configuration:', {
    endpoint,
    region,
    accountName: process.env.S3_ACCOUNT_NAME,
    disableSSLVerification: process.env.S3_DISABLE_SSL_VERIFICATION === 'true',
  });

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Force path-style addressing for on-premises S3
    forcePathStyle: true,
  });
};

let s3Client: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = initializeS3Client();
  }
  return s3Client;
};

/**
 * List all buckets
 */
export const listBuckets = async () => {
  try {
    const client = getS3Client();
    const command = new ListBucketsCommand({});
    const response = await client.send(command);
    return response.Buckets || [];
  } catch (error) {
    console.error('Error listing buckets:', error);
    throw error;
  }
};

/**
 * List objects in a bucket with prefix (folder)
 */
export const listObjects = async (
  bucket: string,
  prefix: string = '',
  maxKeys: number = 1000,
  continuationToken?: string
) => {
  try {
    const client = getS3Client();
    
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      Delimiter: '/',
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    return {
      objects: (response.Contents || []).map((obj) => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        isFolder: false,
        etag: obj.ETag,
        storageClass: obj.StorageClass,
      })),
      commonPrefixes: (response.CommonPrefixes || []).map((cp) => ({
        key: cp.Prefix || '',
        size: 0,
        lastModified: new Date(),
        isFolder: true,
      })),
      isTruncated: response.IsTruncated || false,
      continuationToken: response.NextContinuationToken,
      currentPrefix: prefix,
      bucket,
    };
  } catch (error) {
    console.error(`Error listing objects in ${bucket}/${prefix}:`, error);
    throw error;
  }
};

/**
 * Search for objects matching a query pattern
 */
export const searchObjects = async (
  bucket: string,
  query: string,
  maxResults: number = 100
): Promise<any[]> => {
  try {
    const client = getS3Client();
    const results: any[] = [];
    let continuationToken: string | undefined;

    // Search through all objects with pagination
    while (results.length < maxResults) {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: Math.min(1000, maxResults - results.length),
        ContinuationToken: continuationToken,
      });

      const response = await client.send(command);

      const filtered = (response.Contents || [])
        .filter((obj) => obj.Key?.toLowerCase().includes(query.toLowerCase()))
        .map((obj) => ({
          key: obj.Key || '',
          size: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
          isFolder: false,
          bucket,
        }));

      results.push(...filtered);

      if (!response.IsTruncated) break;
      continuationToken = response.NextContinuationToken;
    }

    return results.slice(0, maxResults);
  } catch (error) {
    console.error(`Error searching in ${bucket}:`, error);
    throw error;
  }
};

/**
 * Get a signed URL for downloading an object
 */
export const getDownloadUrl = async (
  bucket: string,
  key: string,
  expiresIn: number = 3600 // 1 hour by default
): Promise<string> => {
  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error(`Error generating download URL for ${bucket}/${key}:`, error);
    throw error;
  }
};

/**
 * Delete an object
 */
export const deleteObject = async (bucket: string, key: string): Promise<void> => {
  try {
    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    console.error(`Error deleting ${bucket}/${key}:`, error);
    throw error;
  }
};

/**
 * Delete multiple objects
 */
export const deleteObjects = async (
  bucket: string,
  keys: string[]
): Promise<void> => {
  try {
    const client = getS3Client();
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    await client.send(command);
  } catch (error) {
    console.error(`Error deleting multiple objects from ${bucket}:`, error);
    throw error;
  }
};

/**
 * Upload an object
 */
export const uploadObject = async (
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string = 'application/octet-stream'
): Promise<void> => {
  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await client.send(command);
  } catch (error) {
    console.error(`Error uploading to ${bucket}/${key}:`, error);
    throw error;
  }
};

/**
 * Check if bucket exists and is accessible
 */
export const checkBucketAccess = async (bucket: string): Promise<boolean> => {
  try {
    const client = getS3Client();
    const command = new HeadBucketCommand({
      Bucket: bucket,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error(`Cannot access bucket ${bucket}:`, error);
    return false;
  }
};

/**
 * Helper function to determine if a key represents a folder
 */
export const isFolder = (key: string): boolean => {
  return key.endsWith('/');
};

/**
 * Extract folder path from an object key
 */
export const getFolderPath = (key: string): string => {
  const parts = key.split('/');
  return parts.slice(0, -1).join('/');
};

/**
 * Get object name from key (without path)
 */
export const getObjectName = (key: string): string => {
  return key.split('/').pop() || key;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
