import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import SkiLayer from '../SkiLayer';
import { fetchSkiResorts } from '../../services/skiApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeSkiResort } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/skiApi', () => ({ fetchSkiResorts: vi.fn() }));

const fetchMock = vi.mocked(fetchSkiResorts);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const NOT_REPORTING = {
  snowfall24hr: null,
  snowfallCumulative: null,
  baseDepth: null,
  tempCurrent: null,
  liftsOpen: 0,
  liftsTotal: 1,
  trailsOpen: 0,
  trailsTotal: 1,
};

describe('SkiLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    fetchMock.mockResolvedValue([
      makeSkiResort(),
      makeSkiResort({ id: 'jay', name: 'Jay Peak', color: 'red' }),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds one marker per resort when visible and removes them all on unmount', async () => {
    const { unmount } = render(<SkiLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]?.lngLat).toEqual([-72.78, 44.53]);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('fetches while hidden (for links/search) but only shows markers while visible', async () => {
    const onLoaded = vi.fn();
    const { rerender } = render(
      <SkiLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    expect(onLoaded.mock.calls[0]![0]).toHaveLength(2);
    expect(liveMarkers()).toHaveLength(0);

    rerender(<SkiLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    rerender(
      <SkiLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    expect(liveMarkers()).toHaveLength(0);
  });

  it('fills by conditions with the Ski layer ring and a spoken name', async () => {
    fetchMock.mockResolvedValue([
      makeSkiResort(),
      makeSkiResort({ id: 'jay', name: 'Jay Peak', color: 'red' }),
      makeSkiResort({ id: 'bolton', name: 'Bolton Valley', color: 'red', ...NOT_REPORTING }),
    ]);
    render(<SkiLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(3));
    const [stowe, jay, bolton] = liveMarkers().map((m) => m.getElement());

    for (const el of [stowe!, jay!, bolton!]) {
      expect(el.style.getPropertyValue('--layer-color')).toBe('#0891b2');
      expect(el.classList.contains('map-marker--status')).toBe(true);
      expect(el.getAttribute('role')).toBe('button');
    }
    expect(stowe!.style.getPropertyValue('--marker-fill')).toBe('#16a34a');
    expect(jay!.style.getPropertyValue('--marker-fill')).toBe('#dc2626');
    // Off-season: grey, not the red "limited conditions"
    expect(bolton!.style.getPropertyValue('--marker-fill')).toBe('#64748b');

    expect(stowe!.getAttribute('aria-label')).toBe('Ski area: Stowe, good conditions');
    expect(bolton!.getAttribute('aria-label')).toBe('Ski area: Bolton Valley, not reporting yet');
  });

  it('opens the clicked resort via onSelect, without a popup', async () => {
    const onSelect = vi.fn();
    render(<SkiLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[1]!.getElement());
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'jay' }));
    expect(openPopups()).toHaveLength(0);
  });

  it('renders no markers when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SkiLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('puts hostile upstream strings into the marker name as text, never markup', async () => {
    fetchMock.mockResolvedValue([makeSkiResort({ name: XSS_PAYLOAD, color: XSS_PAYLOAD })]);
    render(<SkiLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
