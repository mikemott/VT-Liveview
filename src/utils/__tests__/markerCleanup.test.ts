/**
 * Tests for marker cleanup helpers.
 */
import { describe, it, expect, vi } from 'vitest';
import { cleanupMarker, cleanupMarkers, type MarkerEntry } from '../markerCleanup';
import type { Marker } from '@/types';

function makeEntry(): MarkerEntry & { remove: ReturnType<typeof vi.fn> } {
  const remove = vi.fn();
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('click', handler);
  return { marker: { remove } as unknown as Marker, element, handler, remove };
}

describe('cleanupMarker', () => {
  it('detaches the click handler and removes the marker', () => {
    const entry = makeEntry();
    cleanupMarker(entry);
    entry.element.click();
    expect(entry.handler).not.toHaveBeenCalled();
    expect(entry.remove).toHaveBeenCalledTimes(1);
  });
});

describe('cleanupMarkers', () => {
  it('cleans up every entry and empties the array in place', () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()];
    const copy = [...entries];
    const list: MarkerEntry[] = entries;
    cleanupMarkers(list);
    expect(list).toHaveLength(0);
    copy.forEach((e) => {
      expect(e.remove).toHaveBeenCalledTimes(1);
      e.element.click();
      expect(e.handler).not.toHaveBeenCalled();
    });
  });

  it('is a no-op on an empty array', () => {
    const list: MarkerEntry[] = [];
    expect(() => cleanupMarkers(list)).not.toThrow();
  });
});
