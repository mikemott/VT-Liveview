/**
 * Tests for month-based seasonal layer selection.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeasonalLayers } from '../useSeasonalLayers';
import type { LayerConfig } from '@/config/seasonalLayers';

function atMonth(month: number): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, month - 1, 15, 12));
}

const ids = (layers: LayerConfig[]) => layers.map((l) => l.id);

afterEach(() => {
  vi.useRealTimers();
});

describe('useSeasonalLayers', () => {
  it.each([11, 12, 1, 2, 3])('month %i is ski season', (month) => {
    atMonth(month);
    const { result } = renderHook(() => useSeasonalLayers());
    expect(result.current.currentMonth).toBe(month);
    expect(ids(result.current.inSeason)).toEqual(['skiResorts']);
    expect(ids(result.current.outOfSeason)).toEqual(['creemeeStands']);
  });

  it.each([4, 5, 6, 7, 8, 9])('month %i is creemee season', (month) => {
    atMonth(month);
    const { result } = renderHook(() => useSeasonalLayers());
    expect(ids(result.current.inSeason)).toEqual(['creemeeStands']);
    expect(ids(result.current.outOfSeason)).toEqual(['skiResorts']);
  });

  it('October is in neither season', () => {
    atMonth(10);
    const { result } = renderHook(() => useSeasonalLayers());
    expect(result.current.inSeason).toEqual([]);
    expect(result.current.outOfSeason).toHaveLength(2);
  });

  it('isInSeason treats layers without a season as always available', () => {
    atMonth(10);
    const { result } = renderHook(() => useSeasonalLayers());
    const always = { id: 'x', label: 'X', icon: () => null, component: () => null } as LayerConfig;
    const summer = {
      ...always,
      season: { months: [6, 7, 8], label: 'Summer' },
    } as LayerConfig;
    expect(result.current.isInSeason(always)).toBe(true);
    expect(result.current.isInSeason(summer)).toBe(false);
  });

  it('returns a stable result across re-renders in the same month', () => {
    atMonth(1);
    const { result, rerender } = renderHook(() => useSeasonalLayers());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
