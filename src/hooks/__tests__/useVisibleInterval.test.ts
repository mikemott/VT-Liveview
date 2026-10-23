import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibleInterval } from '../useVisibleInterval';

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useVisibleInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('ticks on the interval while visible, without an immediate first run', () => {
    const cb = vi.fn();
    renderHook(() => useVisibleInterval(cb, 1000));
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('pauses while hidden and catches up once when visible again if overdue', () => {
    const cb = vi.fn();
    renderHook(() => useVisibleInterval(cb, 1000));
    setVisibility('hidden');
    vi.advanceTimersByTime(10_000);
    expect(cb).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(cb).toHaveBeenCalledTimes(1); // immediate catch-up
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not run on return if the interval has not elapsed', () => {
    const cb = vi.fn();
    renderHook(() => useVisibleInterval(cb, 1000));
    setVisibility('hidden');
    vi.advanceTimersByTime(300);
    setVisibility('visible');
    expect(cb).not.toHaveBeenCalled();
  });

  it('does nothing when the delay is null and cleans up on unmount', () => {
    const cb = vi.fn();
    const { rerender, unmount } = renderHook(({ d }) => useVisibleInterval(cb, d), {
      initialProps: { d: null as number | null },
    });
    vi.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
    rerender({ d: 1000 });
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
