import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RadarOverlay from '../RadarOverlay';
import type { UseRadarAnimationReturn } from '../../hooks/useRadarAnimation';
import { FakeMap, resetMaplibreMock } from '../../test/maplibreMock';
import { makeRadarFrames } from '../../__fixtures__/components/data';

const hook = vi.hoisted(() => {
  const holder: { value: unknown } = { value: undefined };
  return holder;
});

vi.mock('../../hooks/useRadarAnimation', () => ({
  useRadarAnimation: () => hook.value,
}));

function makeHook(overrides: Partial<UseRadarAnimationReturn> = {}): UseRadarAnimationReturn {
  const frames = overrides.frames ?? makeRadarFrames(3);
  const currentFrame = overrides.currentFrame ?? 0;
  return {
    frames,
    currentFrame,
    currentFrameData: frames[currentFrame] ?? null,
    isPlaying: false,
    isLoading: false,
    error: null,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    goToFrame: vi.fn(),
    nextFrame: vi.fn(),
    prevFrame: vi.fn(),
    refresh: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

const layerIds = (n: number) => Array.from({ length: n }, (_, i) => `radar-layer-${i}`);
const sourceIds = (n: number) => Array.from({ length: n }, (_, i) => `radar-source-${i}`);

async function flushSequentialAdds(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

describe('RadarOverlay', () => {
  let fake: FakeMap;
  let state: UseRadarAnimationReturn;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fake = new FakeMap();
    state = makeHook();
    hook.value = state;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetMaplibreMock();
  });

  it('adds one raster source/layer per frame and removes them all on unmount', async () => {
    const { unmount } = render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(fake.sourceIds()).toEqual(sourceIds(3));
    expect(fake.layerIds()).toEqual(layerIds(3));
    const tiles = fake.getSource('radar-source-1')?.spec.tiles as string[];
    expect(tiles[0]).toBe(state.frames[1]?.tileUrl);

    unmount();
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
    expect(fake.errors).toEqual([]);
  });

  it('shows only the current frame at the chosen opacity', async () => {
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(fake.getLayoutProperty('radar-layer-0', 'visibility')).toBe('visible');
    expect(fake.getPaintProperty('radar-layer-0', 'raster-opacity')).toBe(0.7);

    fireEvent.change(screen.getByLabelText('Radar overlay opacity'), {
      target: { value: '0.3' },
    });
    expect(fake.getPaintProperty('radar-layer-0', 'raster-opacity')).toBe(0.3);
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('hides all radar layers when toggled off', async () => {
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    fireEvent.click(screen.getByRole('button', { name: 'Hide radar overlay' }));
    for (const id of layerIds(3)) {
      expect(fake.getLayoutProperty(id, 'visibility')).toBe('none');
    }
    expect(screen.queryByLabelText('Radar timeline')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show radar overlay' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches the visible layer when the current frame changes', async () => {
    const { rerender } = render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    hook.value = { ...state, currentFrame: 1, currentFrameData: state.frames[1] ?? null };
    rerender(<RadarOverlay map={fake.asMap()} />);
    expect(fake.getLayoutProperty('radar-layer-0', 'visibility')).toBe('none');
    expect(fake.getLayoutProperty('radar-layer-1', 'visibility')).toBe('visible');
    expect(fake.getPaintProperty('radar-layer-1', 'raster-opacity')).toBe(0.7);
  });

  it('recreates sources with new URLs when frames refresh', async () => {
    const { rerender } = render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    const refreshed = makeRadarFrames(3).map((f) => ({ ...f, tileUrl: `${f.tileUrl}?v=2` }));
    hook.value = { ...state, frames: refreshed, currentFrameData: refreshed[0] ?? null };
    rerender(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(fake.layerIds()).toEqual(layerIds(3));
    const tiles = fake.getSource('radar-source-2')?.spec.tiles as string[];
    expect(tiles[0]).toContain('?v=2');
  });

  it('drops extra layers when the frame count shrinks', async () => {
    const { rerender } = render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    const fewer = makeRadarFrames(2);
    hook.value = { ...state, frames: fewer, currentFrameData: fewer[0] ?? null };
    rerender(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(fake.layerIds()).toEqual(layerIds(2));
    expect(fake.sourceIds()).toEqual(sourceIds(2));
  });

  it('wires the playback controls to the animation hook', async () => {
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    fireEvent.click(screen.getByRole('button', { name: 'Play radar animation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next radar frame' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous radar frame' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh radar data' }));
    expect(state.toggle).toHaveBeenCalledTimes(1);
    expect(state.nextFrame).toHaveBeenCalledTimes(1);
    expect(state.prevFrame).toHaveBeenCalledTimes(1);
    expect(state.refresh).toHaveBeenCalledTimes(1);

    const timeline = screen.getByRole('slider', { name: 'Radar timeline' });
    fireEvent.keyDown(timeline, { key: 'ArrowRight' });
    fireEvent.keyDown(timeline, { key: 'ArrowLeft' });
    expect(state.nextFrame).toHaveBeenCalledTimes(2);
    expect(state.prevFrame).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(timeline, { key: 'End' });
    expect(state.goToFrame).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(timeline, { key: 'Home' });
    expect(state.goToFrame).toHaveBeenLastCalledWith(0);
    expect(timeline).toHaveAttribute('aria-valuemax', '2');
  });

  it('jumps to a frame when its timeline dot is clicked, without nested controls (FINDINGS H16)', async () => {
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    const timeline = screen.getByRole('slider', { name: 'Radar timeline' });
    // A slider's children are presentational: nothing inside may be focusable.
    expect(timeline.querySelectorAll('button, [tabindex]')).toHaveLength(0);

    const dots = timeline.querySelectorAll<HTMLElement>('[data-frame]');
    expect(dots).toHaveLength(3);
    fireEvent.click(dots[2]!);
    expect(state.goToFrame).toHaveBeenCalledWith(2);
  });

  it('shows the pause label and forecast badge for nowcast frames', async () => {
    const frames = makeRadarFrames(2).map((f, i) => ({ ...f, isNowcast: i === 1 }));
    hook.value = makeHook({ frames, currentFrame: 1, isPlaying: true });
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(screen.getByRole('button', { name: 'Pause radar animation' })).toBeInTheDocument();
    expect(screen.getByText('Forecast')).toBeInTheDocument();
  });

  it('disables controls while loading and with no frames', () => {
    hook.value = makeHook({ frames: [], isLoading: true });
    render(<RadarOverlay map={fake.asMap()} />);
    expect(screen.getByRole('button', { name: 'Play radar animation' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh radar data' })).toBeDisabled();
    const timeline = screen.getByRole('slider', { name: 'Radar timeline' });
    expect(timeline).toHaveAttribute('aria-valuetext', 'No frames available');
    fireEvent.keyDown(timeline, { key: 'ArrowRight' });
    expect(fake.layerIds()).toEqual([]);
  });

  it('adds layers, enables controls and cleans up while isStyleLoaded() is false (FINDINGS H11)', async () => {
    // isStyleLoaded() is false whenever tiles are still loading; it must not block init.
    fake.styleLoaded = false;
    const { unmount } = render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(fake.layerIds()).toEqual(layerIds(3));
    expect(screen.queryByText('Loading radar tiles...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous radar frame' })).toBeEnabled();

    unmount();
    expect(fake.layerIds()).toEqual([]);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.errors).toEqual([]);
  });

  it('renders the collapsed variant', () => {
    render(<RadarOverlay map={fake.asMap()} collapsed isDark />);
    expect(screen.getByText('Hidden for stargazing')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('makes the current frame visible once its layer is added by the async loop (FINDINGS H10)', async () => {
    // The newest frame is current, so its layer is the last one the loop adds.
    hook.value = makeHook({ currentFrame: 2 });
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(fake.getLayoutProperty('radar-layer-2', 'visibility')).toBe('visible');
    expect(fake.getPaintProperty('radar-layer-2', 'raster-opacity')).toBe(0.7);
    expect(fake.getLayoutProperty('radar-layer-0', 'visibility')).toBe('none');
  });

  it('cancels the sequential layer-add loop on unmount (FINDINGS H10)', async () => {
    const { unmount } = render(<RadarOverlay map={fake.asMap()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(fake.layerIds().length).toBeGreaterThan(0);
    expect(fake.layerIds().length).toBeLessThan(3);

    unmount();
    await flushSequentialAdds();
    expect(fake.layerIds()).toEqual([]);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.errors).toEqual([]);
  });

  it('does not interleave an old add loop with a refreshed one (FINDINGS H10)', async () => {
    const { rerender } = render(<RadarOverlay map={fake.asMap()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const refreshed = makeRadarFrames(3).map((f) => ({ ...f, tileUrl: `${f.tileUrl}?v=2` }));
    hook.value = { ...state, frames: refreshed, currentFrameData: refreshed[0] ?? null };
    rerender(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();

    expect(fake.layerIds()).toEqual(layerIds(3));
    for (const id of sourceIds(3)) {
      expect((fake.getSource(id)?.spec.tiles as string[])[0]).toContain('?v=2');
    }
    expect(fake.errors).toEqual([]);
  });

  it('stops adding layers if the map rejects them (style being replaced)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const addSource = vi.spyOn(fake, 'addSource').mockImplementation(() => {
      throw new Error('Style is not done loading');
    });
    render(<RadarOverlay map={fake.asMap()} />);
    await flushSequentialAdds();
    expect(addSource).toHaveBeenCalledTimes(1);
    expect(fake.layerIds()).toEqual([]);
    expect(screen.getByText('Loading radar tiles...')).toBeInTheDocument();
  });
});
