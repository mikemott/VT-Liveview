/**
 * Hook to detect mobile viewport
 * Returns true when viewport width is <= breakpoint (default 768px)
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    // Check on initial render (SSR-safe)
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    const checkMobile = (): void => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    // Check immediately in case initial state was wrong
    checkMobile();

    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
