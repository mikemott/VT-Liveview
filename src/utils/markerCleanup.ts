/**
 * Marker Cleanup Utilities
 * Centralized cleanup logic for MapLibre markers to prevent memory leaks
 */

import type { Marker } from '../types';

/**
 * Marker entry with cleanup handler
 */
export interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

/**
 * Clean up a single marker entry
 * Removes event listeners and marker from map
 */
export function cleanupMarker(entry: MarkerEntry): void {
  const { marker, element, handler } = entry;

  if (element && handler) {
    element.removeEventListener('click', handler as EventListener);
  }

  marker.remove();
}

/**
 * Clean up an array of marker entries
 * Removes all event listeners and markers from map
 */
export function cleanupMarkers(markers: MarkerEntry[]): void {
  markers.forEach(cleanupMarker);
  markers.length = 0; // Clear array in place
}
