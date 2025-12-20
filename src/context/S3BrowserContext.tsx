'use client';

/**
 * S3 Browser Context
 * Manages global state for view mode and preferences
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

type ViewMode = 'grid' | 'list';

interface S3BrowserContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const S3BrowserContext = createContext<S3BrowserContextType | undefined>(undefined);

export function S3BrowserProvider({ children }: { children: React.ReactNode }) {
  // Load initial view mode from localStorage
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('s3-browser-view-mode');
      return (saved as ViewMode) || 'list';
    }
    return 'list';
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('s3-browser-view-mode', mode);
    }
  }, []);

  return (
    <S3BrowserContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </S3BrowserContext.Provider>
  );
}

export function useS3BrowserContext() {
  const context = useContext(S3BrowserContext);
  if (!context) {
    throw new Error('useS3BrowserContext must be used within S3BrowserProvider');
  }
  return context;
}
