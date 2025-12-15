'use client';
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <main className="text-center space-y-8 px-4">
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
      </main>
    </div>
  );
}

// Bucket Selector Component
import { useS3Buckets } from '@/hooks';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

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
