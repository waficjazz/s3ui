'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UploadPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: string;
  prefix: string;
  files: File[];
  uploading: boolean;
  onConfirm: () => void;
}

export function UploadPreview({
  open,
  onOpenChange,
  bucket,
  prefix,
  files,
  uploading,
  onConfirm,
}: UploadPreviewProps) {
  const handleCancel = () => {
    if (!uploading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Upload</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-4">
          {/* Upload Destination */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-4">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Upload Destination
            </p>
            <p className="text-base font-mono text-blue-800 dark:text-blue-200 break-all">
              <span className="font-bold">{bucket}</span>
              <span className="text-gray-600 dark:text-gray-400">/</span>
              <span>{prefix || '(root)'}</span>
            </p>
          </div>

          {/* Files to Upload */}
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded p-4">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Files ({files.length})
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map((file, idx) => {
                const relativePath = (file as any).webkitRelativePath || file.name;
                const fileSize = (file.size / 1024).toFixed(2);
                return (
                  <div
                    key={idx}
                    className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-xs text-gray-700 dark:text-gray-300 break-all flex justify-between items-start gap-3"
                  >
                    <span>
                      <span className="text-gray-500 dark:text-gray-400">└ </span>
                      {relativePath}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fileSize} KB
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {uploading ? 'Uploading...' : 'Confirm Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
