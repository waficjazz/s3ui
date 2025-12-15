'use client';

/**
 * BreadcrumbNav Component
 * Shows the current path in the S3 bucket and allows navigation
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface BreadcrumbNavProps {
  bucket: string;
  prefix: string;
  onNavigate: (prefix: string) => void;
}

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
  bucket,
  prefix,
  onNavigate,
}) => {
  // Parse the path into segments
  const segments = prefix
    .split('/')
    .filter(Boolean);

  // Generate breadcrumb items
  const breadcrumbs = [
    {
      label: bucket,
      path: '',
      isRoot: true,
    },
    ...segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join('/') + '/',
      isRoot: false,
    })),
  ];

  return (
    <div className="flex items-center gap-2 p-4 bg-white border border-gray-200 rounded-lg overflow-x-auto">
      {/* Home Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate('')}
        title="Go to bucket root"
        className="flex-shrink-0"
      >
        🏠
      </Button>

      {/* Breadcrumb Items */}
      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.path || 'root'}>
          {/* Separator */}
          {index > 0 && (
            <span className="text-gray-400 flex-shrink-0">›</span>
          )}

          {/* Breadcrumb Item */}
          <Button
            variant={breadcrumb.path === prefix ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onNavigate(breadcrumb.path)}
            className="flex-shrink-0 whitespace-nowrap"
          >
            {breadcrumb.isRoot ? (
              <div className="flex items-center gap-1">
                <span>📁</span>
                <span className="font-semibold">{breadcrumb.label}</span>
              </div>
            ) : (
              breadcrumb.label
            )}
          </Button>
        </React.Fragment>
      ))}

      {/* Edit Path Manually (Optional) */}
      <div className="ml-auto flex-shrink-0 text-xs text-gray-500">
        {prefix && `${prefix.split('/').filter(Boolean).length} level(s)`}
      </div>
    </div>
  );
};
