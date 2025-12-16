'use client';

import { signIn } from 'next-auth/react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  useEffect(() => {
    // Auto-trigger sign in when page loads
    // This will redirect to Keycloak immediately without showing a prompt
    signIn('keycloak', { 
      redirect: true,
      callbackUrl: '/'
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="space-y-4">
          <div className="text-6xl">☁️</div>
          <h1 className="text-4xl font-bold text-gray-900">S3 Browser</h1>
          <p className="text-xl text-gray-600">
            Secure on-premises S3 storage access
          </p>
        </div>

        <div className="pt-8">
          <div className="bg-white rounded-lg shadow p-8 max-w-md mx-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
              </div>
              <p className="text-gray-600">
                Redirecting to Keycloak for authentication...
              </p>
              <p className="text-sm text-gray-500">
                If you are not redirected automatically, click the button below.
              </p>
              <Button
                onClick={() => signIn('keycloak', { 
                  redirect: true,
                  callbackUrl: '/'
                })}
                className="w-full"
              >
                Sign in with Keycloak
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
