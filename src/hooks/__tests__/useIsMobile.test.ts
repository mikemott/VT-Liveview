/**
 * Tests for the viewport-width mobile detection hook.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../useIsMobile';

const originalWidth = window.innerWidth;

function setWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
}

afterEach(() => {
  setWidth(originalWidth);
});

describe('useIsMobile', () => {
  it('is true at or below the 768px default breakpoint', () => {
    setWidth(768);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
    setWidth(375);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('is false above the breakpoint', () => {
    setWidth(769);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('updates on window resize', () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setWidth(500);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);

    act(() => {
      setWidth(1200);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('respects a custom breakpoint and reacts when it changes', () => {
    setWidth(900);
    const { result, rerender } = renderHook(({ bp }) => useIsMobile(bp), {
      initialProps: { bp: 1000 },
    });
    expect(result.current).toBe(true);
    rerender({ bp: 800 });
    expect(result.current).toBe(false);
  });

  it('removes its resize listener on unmount', () => {
    setWidth(1024);
    const { result, unmount } = renderHook(() => useIsMobile());
    unmount();
    setWidth(400);
    window.dispatchEvent(new Event('resize'));
    expect(result.current).toBe(false);
  });
});
