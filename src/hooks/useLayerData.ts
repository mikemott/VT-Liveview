/**
 * Data for a map layer (VTL-64): fetched once there's a map (also while the
 * layer is hidden, so search and shared links can find its items), then
 * refreshed every `refreshMs` while the page is visible. A failed refresh
 * keeps the last good items. `onLoaded` gets each successful result.
 */
import { useEffect, useRef, useState } from 'react';
import { useVisibleInterval } from './useVisibleInterval';

export function useLayerData<T>(
  enabled: boolean,
  fetcher: () => Promise<T[]>,
  refreshMs: number,
  onLoaded?: (items: T[]) => void,
  label = 'layer data',
): T[] {
  const [items, setItems] = useState<T[]>([]);
  const fetcherRef = useRef(fetcher);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    fetcherRef.current = fetcher;
    onLoadedRef.current = onLoaded;
  }, [fetcher, onLoaded]);

  const [tick, setTick] = useState(0);
  useVisibleInterval(() => setTick((t) => t + 1), enabled ? refreshMs : null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const data = await fetcherRef.current();
        if (cancelled) return;
        setItems(data);
        onLoadedRef.current?.(data);
      } catch (error) {
        if (import.meta.env.DEV) console.error(`Error fetching ${label}:`, error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, tick, label]);

  return items;
}
