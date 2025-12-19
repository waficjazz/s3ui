'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import Link from 'next/link';

export const AdminButton: React.FC = () => {
  const { data: session, status } = useSession();

  if (status === 'loading' || !session?.user || !(session.user as any).isAdmin) {
    return null;
  }
  
  return (
    <Link href="/admin/rbac">
      <Button variant="outline" size="sm" className="gap-2">
        <Settings className="w-4 h-4" />
        {/* Admin */}
      </Button>
    </Link>
  );
};
