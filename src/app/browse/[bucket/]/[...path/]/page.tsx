'use client';

/**
 * S3 Browse Page
 * Dynamic page for browsing S3 buckets and their contents
 * Route: /browse/[bucket]/[...path]
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useS3Browse, useS3Download, useS3Buckets } from '@/hooks';
import { BreadcrumbNav } from '@/components/s3-browser/BreadcrumbNav';
import { SearchBar } from '@/components/s3-browser/SearchBar';
import { FileBrowser } from '@/components/s3-browser/FileBrowser';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BrowsePageProps {
  params: {
    bucket: string;
    path?: string[];
  };
}

export default function BrowsePage({ params }: BrowsePageProps) {
  const router = useRouter();
  const { bucket, path = [] } = params;

  // Decode bucket name
  const decodedBucket = decodeURIComponent(bucket);
  
  // Construct prefix from path array
  const prefix = path ? path.map(p => decodeURIComponent(p)).join('/') : '';
  const fullPrefix = prefix ? prefix + '/' : '';

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDownloadProgress, setShowDownloadProgress] = useState(false);

  // Fetch buckets for dropdown
  const { buckets, loading: bucketsLoading } = useS3Buckets();

  // Fetch current folder contents
  const { data, loading, error, refetch } = useS3Browse({
    bucket: decodedBucket,
    prefix: fullPrefix,
  });

  // Download hook
  const { downloading, download, progress, error: downloadError } = useS3Download();

  // Handle folder navigation
  const handleFolderClick = useCallback((folderPath: string) => {
    const pathSegments = folderPath
      .split('/')
      .filter(Boolean)
      .map(seg => encodeURIComponent(seg));
    
    const newPath = pathSegments.length > 0 ? `/browse/${encodeURIComponent(decodedBucket)}/${pathSegments.join('/')}` : `/browse/${encodeURIComponent(decodedBucket)}`;
    router.push(newPath);
  }, [decodedBucket, router]);

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((newPrefix: string) => {
    if (!newPrefix) {
      router.push(`/browse/${encodeURIComponent(decodedBucket)}`);
    } else {
      const pathSegments = newPrefix
        .split('/')
        .filter(Boolean)
        .map(seg => encodeURIComponent(seg));
      router.push(`/browse/${encodeURIComponent(decodedBucket)}/${pathSegments.join('/')}`);
    }
  }, [decodedBucket, router]);

  // Handle file download
  const handleDownload = useCallback(async (key: string, fileName: string) => {
    setShowDownloadProgress(true);
    try {
      await download(decodedBucket, key, fileName);
    } finally {
      setShowDownloadProgress(false);
    }
  }, [decodedBucket, download]);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchQuery(query);
    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const params = new URLSearchParams({
        bucket: decodedBucket,
        query,
        maxResults: '50',
      });

      const response = await fetch(`/api/s3/search?${params}`);
      const result = await response.json();

      if (result.success) {
        setSearchResults(result.data || []);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [decodedBucket]);

  // Handle bucket change
  const handleBucketChange = useCallback((newBucket: string) => {
    router.push(`/browse/${encodeURIComponent(newBucket)}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo/Title */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">☁️</span>
              <h1 className="text-2xl font-bold text-gray-900">S3 Browser</h1>
            </div>

            {/* Bucket Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-48">
                  📁 {decodedBucket}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-h-96 overflow-y-auto">
                {bucketsLoading ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Loading buckets...
                  </div>
                ) : buckets.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No buckets available
                  </div>
                ) : (
                  buckets.map((b) => (
                    <DropdownMenuItem
                      key={b.name}
                      onClick={() => handleBucketChange(b.name)}
                      className={decodedBucket === b.name ? 'bg-blue-50' : ''}
                    >
                      {decodedBucket === b.name && '✓ '}
                      {b.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumb Navigation */}
        <BreadcrumbNav
          bucket={decodedBucket}
          prefix={fullPrefix}
          onNavigate={handleBreadcrumbNavigate}
        />

        {/* Search Bar */}
        <SearchBar onSearch={handleSearch} isLoading={isSearching} />

        {/* Download Progress Dialog */}
        {showDownloadProgress && (
          <Dialog open={showDownloadProgress} onOpenChange={setShowDownloadProgress}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Downloading File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm text-gray-600">{progress}%</p>
                {downloadError && (
                  <p className="text-center text-sm text-red-600">
                    Error: {downloadError.message}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Search Results */}
        {showSearchResults && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Search Results for "{searchQuery}"
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSearchResults(false)}
              >
                ✕ Clear
              </Button>
            </div>

            {searchResults.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No files found matching "{searchQuery}"
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <div
                    key={`${result.key}-${index}`}
                    className="p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.key}</p>
                      <p className="text-xs text-gray-500">
                        {result.size ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'Folder'}
                      </p>
                    </div>
                    {result.size && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleDownload(
                            result.key,
                            result.key.split('/').pop() || 'download'
                          )
                        }
                        className="ml-2 flex-shrink-0"
                      >
                        ⬇
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File Browser */}
        <FileBrowser
          data={showSearchResults ? null : data}
          loading={loading && !showSearchResults}
          error={error}
          onFolderClick={handleFolderClick}
          onDownload={handleDownload}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-gray-600">
          <p>S3 Browser • Secure on-premises file access</p>
        </div>
      </footer>
    </div>
  );
}
