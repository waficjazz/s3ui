'use client';

/**
 * UserMenu Component
 * Displays user info and logout button
 */

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export const UserMenu: React.FC = () => {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const userName = session.user.name || session.user.email || 'User';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-10 h-10 rounded-full p-0 flex items-center justify-center gap-2"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
            {userInitials}
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User Info */}
        <div className="px-2 py-3 space-y-1">
          <p className="text-sm font-semibold text-gray-900">{userName}</p>
          {session.user.email && (
            <p className="text-xs text-gray-500">{session.user.email}</p>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Menu Items */}
        {/* <DropdownMenuItem asChild>
          <button className="w-full text-left">
            👤 Profile
          </button>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <button className="w-full text-left">
            ⚙️ Settings
          </button>
        </DropdownMenuItem> */}

        {/* <DropdownMenuSeparator /> */}

        {/* Logout */}
        <DropdownMenuItem
          onClick={async () => {
            await signOut({
              redirect: true,
              callbackUrl: '/',
            });
          }}
          className="text-red-600 cursor-pointer"
        >
          🚪 Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
