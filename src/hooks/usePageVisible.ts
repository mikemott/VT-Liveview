import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** True while the page is visible (not a background tab or minimized window). */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState !== 'hidden',
    () => true,
  );
}
