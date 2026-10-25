/**
 * Shows one MapLibre marker per item while `visible`, and removes them all
 * (with their listeners) when hidden, when items change, or on unmount (VTL-64).
 *
 * `build` should be stable (a module-level function or useCallback): a new
 * identity rebuilds every marker. `onActivate` may change freely.
 */
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { MapLibreMap } from '../types';

export interface BuiltMarker {
  lngLat: [number, number];
  element: HTMLDivElement;
  /** MapLibre anchor/offset, e.g. to float a label-like pill above its point */
  anchor?: maplibregl.PositionAnchor;
  offset?: [number, number];
}

export function useMapMarkers<T>(
  map: MapLibreMap | null,
  visible: boolean,
  items: readonly T[],
  build: (item: T) => BuiltMarker | null,
  onActivate: (item: T) => void,
): void {
  const onActivateRef = useRef(onActivate);
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    if (!map || !visible) return;
    const entries: {
      marker: maplibregl.Marker;
      element: HTMLDivElement;
      handler: (e: MouseEvent) => void;
    }[] = [];
    for (const item of items) {
      const built = build(item);
      if (!built) continue;
      const handler = (e: MouseEvent): void => {
        // Don't let the map's own click handler (location details) fire too
        e.stopPropagation();
        onActivateRef.current(item);
      };
      built.element.addEventListener('click', handler);
      const marker = new maplibregl.Marker({
        element: built.element,
        ...(built.anchor ? { anchor: built.anchor } : {}),
        ...(built.offset ? { offset: built.offset } : {}),
      })
        .setLngLat(built.lngLat)
        .addTo(map);
      entries.push({ marker, element: built.element, handler });
    }
    return () => {
      for (const { marker, element, handler } of entries) {
        element.removeEventListener('click', handler);
        marker.remove();
      }
    };
  }, [map, visible, items, build]);
}
