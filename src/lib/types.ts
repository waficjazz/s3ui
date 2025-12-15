/**
 * S3 Related Types and Interfaces
 */

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  isFolder: boolean;
  etag?: string;
  storageClass?: string;
}

export interface BrowseParams {
  bucket: string;
  prefix: string;
  maxKeys?: number;
}

export interface BrowseResponse {
  objects: S3Object[];
  commonPrefixes: S3Object[];
  isTruncated: boolean;
  continuationToken?: string;
  currentPrefix: string;
  bucket: string;
}

export interface SearchParams {
  bucket: string;
  query: string;
  maxResults?: number;
}

export interface SearchResult {
  key: string;
  bucket: string;
  size: number;
  lastModified: Date;
}

export interface DeleteParams {
  bucket: string;
  key: string;
}

export interface DownloadParams {
  bucket: string;
  key: string;
  expiresIn?: number; // in seconds
}

export interface UploadParams {
  bucket: string;
  key: string;
  file: Buffer | Blob;
  contentType?: string;
}

export interface S3Error {
  code: string;
  message: string;
  statusCode: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
