import { useCallback, useState } from 'react';

interface UseS3UploadReturn {
  uploading: boolean;
  uploadError: string | null;
  confirmUpload: (files: File[], bucket: string, fullPrefix: string, onRefetch: () => void) => Promise<void>;
  setUploadError: (error: string | null) => void;
  clearUploadError: () => void;
}

export function useS3Upload(): UseS3UploadReturn {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const confirmUpload = useCallback(
    async (files: File[], bucket: string, fullPrefix: string, onRefetch: () => void) => {
      console.log('confirmUpload called', { filesCount: files.length, bucket, fullPrefix });
      
      if (!files || files.length === 0 || !bucket) {
        console.warn('Upload cancelled: missing files or bucket');
        return;
      }

      try {
        setUploading(true);
        setUploadError(null);
        console.log('Starting upload of', files.length, 'files');

        for (const file of files) {
          // Use webkitRelativePath if available (directory upload), otherwise use file.name
          const relativePath = (file as any).webkitRelativePath || file.name;
          const key = fullPrefix + relativePath;
          console.log('Uploading file:', key);

          const formData = new FormData();
          formData.append('file', file);
          formData.append('bucket', bucket);
          formData.append('key', key);

          const response = await fetch('/api/s3/upload', {
            method: 'POST',
            body: formData,
          });

          console.log('Upload response status:', response.status);
          const result = await response.json();
          console.log('Upload response:', result);

          if (!response.ok || !result.success) {
            throw new Error(result.message || `Failed to upload ${relativePath}`);
          }
        }

        console.log('All files uploaded successfully');
        // Refresh the current folder to show new files
        onRefetch();

        // Reset file inputs
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        const dirInput = document.getElementById('dir-upload') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        if (dirInput) {
          dirInput.value = '';
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(message);
        console.error('Upload error:', err);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  return {
    uploading,
    uploadError,
    confirmUpload,
    setUploadError,
    clearUploadError,
  };
}
