'use client';

/**
 * Hook for downloading files from S3
 */

import { useState, useCallback } from 'react';

interface UseS3DownloadState {
  downloading: boolean;
  error: Error | null;
  progress: number; // 0-100
  download: (bucket: string, key: string, fileName?: string) => Promise<void>;
}

export const useS3Download = (): UseS3DownloadState => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const download = useCallback(async (bucket: string, key: string, fileName?: string) => {
    try {
      setDownloading(true);
      setError(null);
      setProgress(0);

      setProgress(20);

      // Use a proxy download endpoint instead of direct fetch to signed URL
      const params = new URLSearchParams({
        bucket,
        key,
      });

      const response = await fetch(`/api/s3/proxy-download?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download file');
      }

      setProgress(60);

      const blob = await response.blob();
      setProgress(80);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || key.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setProgress(100);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Error downloading file:', error);
    } finally {
      setDownloading(false);
      // Reset progress after a delay
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  return {
    downloading,
    error,
    progress,
    download,
  };
};
