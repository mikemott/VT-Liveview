/**
 * Hook to detect mobile viewport
 * Returns true when viewport width is <= breakpoint (default 768px), or when the
 * screen is short: a phone turned sideways is wide but too short for the
 * desktop layout (VTL-93). Keep in sync with the CSS media queries.
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;
const SHORT_SCREEN = 500;

const isMobileViewport = (breakpoint: number): boolean =>
  window.innerWidth <= breakpoint || window.innerHeight <= SHORT_SCREEN;

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    // Check on initial render (SSR-safe)
    if (typeof window === 'undefined') return false;
    return isMobileViewport(breakpoint);
  });

  useEffect(() => {
    const checkMobile = (): void => {
      setIsMobile(isMobileViewport(breakpoint));
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
