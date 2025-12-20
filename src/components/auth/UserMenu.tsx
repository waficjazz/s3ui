'use client';

/**
 * UserMenu Component
 * Displays user info and logout button
 */

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { LogOut, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export const UserMenu: React.FC = () => {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (status === 'loading' || !mounted) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
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
          <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
            {userInitials}
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User Info */}
        <div className="px-2 py-3 space-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{userName}</p>
          {session.user.email && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{session.user.email}</p>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Theme Toggle */}
        {mounted && (
          <>
            <DropdownMenuItem
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="cursor-pointer"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 mr-2" />
                  Dark Mode
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  Light Mode
                </>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        {/* Logout */}
        <DropdownMenuItem
          onClick={async () => {
            await signOut({
              redirect: true,
              callbackUrl: '/',
            });
          }}
          className="text-red-600 dark:text-red-400 cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
