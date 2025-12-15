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

      // Get signed download URL from API
      const params = new URLSearchParams({
        bucket,
        key,
        expiresIn: '3600', // 1 hour
      });

      const response = await fetch(`/api/s3/download?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate download URL');
      }

      const result = await response.json();
      if (!result.success || !result.data?.url) {
        throw new Error('No download URL received');
      }

      // Download the file
      setProgress(30);

      const downloadResponse = await fetch(result.data.url);
      if (!downloadResponse.ok) {
        throw new Error('Failed to download file');
      }

      setProgress(60);

      const blob = await downloadResponse.blob();
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
