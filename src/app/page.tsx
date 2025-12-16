'use client';
import Image from "next/image";
import { UserMenu } from '@/components/auth/UserMenu';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to default bucket if configured
    const defaultBucket = process.env.NEXT_PUBLIC_DEFAULT_S3_BUCKET;
    if (defaultBucket) {
      router.push(`/browse/${encodeURIComponent(defaultBucket)}`);
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☁️</span>
            <h1 className="text-2xl font-bold text-gray-900">S3 Browser</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <div className="text-6xl">☁️</div>
            <h1 className="text-4xl font-bold text-gray-900">S3 Browser</h1>
            <p className="text-xl text-gray-600">
              Securely browse your on-premises S3 storage
            </p>
          </div>

          <div className="pt-8">
            <p className="text-gray-600 mb-4">
              Select a bucket to get started
            </p>
            <BucketSelector />
          </div>
        </div>
      </main>
    </div>
  );
}

// Bucket Selector Component
import { useS3Buckets } from '@/hooks';
import { Button } from '@/components/ui/button';

function BucketSelector() {
  const { buckets, loading, error } = useS3Buckets();
  const router = useRouter();

  if (loading) {
    return (
      <div className="inline-block">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-md mx-auto">
        <p className="font-semibold">Error loading buckets</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 max-w-md mx-auto">
        <p>No buckets found. Please check your S3 configuration.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
      {buckets.map((bucket) => (
        <Button
          key={bucket.name}
          onClick={() => router.push(`/browse/${encodeURIComponent(bucket.name)}`)}
          className="h-24 flex flex-col items-center justify-center gap-2 bg-white hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400 text-gray-900"
          variant="outline"
        >
          <span className="text-3xl">📁</span>
          <span className="font-semibold truncate w-full px-2">{bucket.name}</span>
        </Button>
      ))}
    </div>
  );
}
