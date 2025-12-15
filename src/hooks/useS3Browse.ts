'use client';

/**
 * Hook for browsing S3 buckets and navigating folders
 */

import { useState, useCallback, useEffect } from 'react';
import { BrowseResponse, S3Object } from '@/lib/types';

interface UseS3BrowseOptions {
  bucket: string;
  prefix?: string;
  maxKeys?: number;
}

interface UseS3BrowseState {
  data: BrowseResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useS3Browse = (options: UseS3BrowseOptions): UseS3BrowseState => {
  const { bucket, prefix = '', maxKeys = 1000 } = options;
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBrowse = useCallback(async () => {
    // Skip if bucket is empty
    if (!bucket) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        bucket,
        prefix,
        maxKeys: maxKeys.toString(),
      });

      const response = await fetch(`/api/s3/browse?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to browse bucket');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error browsing S3:', error);
    } finally {
      setLoading(false);
    }
  }, [bucket, prefix, maxKeys]);

  useEffect(() => {
    fetchBrowse();
  }, [fetchBrowse]);

  return {
    data,
    loading,
    error,
    refetch: fetchBrowse,
  };
};
