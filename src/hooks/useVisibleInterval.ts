import { useEffect, useRef } from 'react';

/**
 * Like setInterval, but paused while the page is hidden (background tab,
 * minimized window, locked phone). When the page becomes visible again and a
 * run is overdue, the callback fires immediately so data is fresh on return.
 *
 * The first run is NOT immediate: components that need data on mount fetch
 * it themselves and use this for the repeating refresh.
 *
 * @param callback  Called on each tick; the latest version is always used.
 * @param delayMs   Interval in ms, or null to disable.
 */
export function useVisibleInterval(callback: () => void, delayMs: number | null): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let lastRun = Date.now();

    const tick = (): void => {
      lastRun = Date.now();
      callbackRef.current();
    };
    const start = (): void => {
      if (timer === null) timer = setInterval(tick, delayMs);
    };
    const stop = (): void => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      if (Date.now() - lastRun >= delayMs) tick();
      start();
    };

    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [delayMs]);
}
