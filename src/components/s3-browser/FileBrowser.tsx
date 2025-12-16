'use client';

/**
 * FileBrowser Component
 * Displays S3 objects (files and folders) in a grid or list view
 */

import React from 'react';
import { BrowseResponse, S3Object } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Folder, File, Grid3x3, List, Download, Trash2, MoreVertical, FolderClosed } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useS3BrowserContext } from '@/context/S3BrowserContext';

interface FileBrowserProps {
  data: BrowseResponse | null;
  loading: boolean;
  error: Error | null;
  onFolderClick: (folderPath: string) => void;
  onDownload: (key: string, fileName: string) => void;
  onDelete?: (key: string) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  data,
  loading,
  error,
  onFolderClick,
  onDownload,
  onDelete,
}) => {
  const { viewMode, setViewMode } = useS3BrowserContext();

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Files</h3>
        <p className="text-red-700 text-sm">{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading files...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  const allItems = [
    ...data.commonPrefixes.map((item) => ({
      ...item,
      isFolder: true,
    })),
    ...data.objects.filter((obj) => !obj.isFolder),
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (isFolder: boolean, key: string) => {
    if (isFolder) {
      return <FolderClosed className="w-8 h-8 text-amber-400" />;
    }

    const ext = key.split('.').pop()?.toLowerCase();
    // You can customize icons based on file extension here
    return <File className="w-8 h-8 text-blue-400" />;
  };

  const getFileName = (key: string): string => {
    return key.split('/').filter(Boolean).pop() || key;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
        <div className="text-sm text-gray-600">
          {allItems.length} items
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="w-10 h-10 p-0"
            title="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="w-10 h-10 p-0"
            title="List view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {allItems.map((item, index) => (
            <Card
              key={`${item.key}-${index}`}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer group"
            >
              <div
                className="text-center space-y-3"
                onClick={() => {
                  if (item.isFolder) {
                    onFolderClick(item.key);
                  }
                }}
              >
                {/* Icon */}
                <div className="flex justify-center">
                  {getFileIcon(item.isFolder, item.key)}
                </div>

                {/* File Name */}
                <div className="truncate">
                  <p className="text-sm font-medium truncate hover:text-blue-600">
                    {getFileName(item.key)}
                  </p>
                </div>

                {/* File Size */}
                {!item.isFolder && (
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(item.size)}
                  </Badge>
                )}

                {/* Actions */}
                {!item.isFolder && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-2 space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        onDownload(item.key, getFileName(item.key));
                      }}
                    >
                      ⬇ Download
                    </Button>
                  </div>
                )}

                {item.isFolder && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500">
                    Click to open
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {allItems.map((item, index) => (
            <Card
              key={`${item.key}-${index}`}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => {
                if (item.isFolder) {
                  onFolderClick(item.key);
                }
              }}
            >
              <div className="flex items-center justify-between gap-4">
                {/* File Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0 hover:text-blue-600">
                  {getFileIcon(item.isFolder, item.key)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getFileName(item.key)}</p>
                    <p className="text-xs text-gray-500">
                      {item.isFolder ? 'Folder' : formatFileSize(item.size)}
                    </p>
                  </div>
                </div>

                {/* Size Badge */}
                {!item.isFolder && (
                  <Badge variant="secondary">{formatFileSize(item.size)}</Badge>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!item.isFolder && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        onDownload(item.key, getFileName(item.key));
                      }}
                      title="Download file"
                    >
                      ⬇
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" title="More options">
                        ⋯
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {item.isFolder && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onFolderClick(item.key);
                          }}
                        >
                          <Folder className="w-4 h-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                      )}
                      {!item.isFolder && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownload(item.key, getFileName(item.key));
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.key);
                          }}
                          className="text-red-600"
                        >
                          🗑 Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {allItems.length === 0 && (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <Folder className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No files or folders in this directory</p>
        </div>
      )}
    </div>
  );
};
