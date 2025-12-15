'use client';

/**
 * Hook for fetching S3 buckets
 */

import { useState, useCallback, useEffect } from 'react';

interface Bucket {
  name: string;
  creationDate?: Date;
}

interface UseS3BucketsState {
  buckets: Bucket[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useS3Buckets = (): UseS3BucketsState => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBuckets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/s3/buckets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch buckets');
      }

      const result = await response.json();
      if (result.success) {
        setBuckets(result.data || []);
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error fetching buckets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  return {
    buckets,
    loading,
    error,
    refetch: fetchBuckets,
  };
};
