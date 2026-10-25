import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import BeachLayer from '../BeachLayer';
import { fetchBeaches } from '../../services/beachApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeBeach } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/beachApi', () => ({ fetchBeaches: vi.fn() }));

const fetchMock = vi.mocked(fetchBeaches);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('BeachLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    // Fixture results are from July 1; keep them "fresh" for these tests
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
    fake = new FakeMap();
    fetchMock.mockResolvedValue([
      makeBeach(),
      makeBeach({ id: 'beach2', name: 'Oakledge', status: 'closed', color: 'red' }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds markers while visible and removes them when hidden or unmounted', async () => {
    const onLoaded = vi.fn();
    const { rerender, unmount } = render(
      <BeachLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    expect(liveMarkers()).toHaveLength(0);

    rerender(<BeachLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]?.lngLat).toEqual([-73.23, 44.49]);

    rerender(
      <BeachLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    expect(liveMarkers()).toHaveLength(0);

    rerender(<BeachLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    unmount();
    expect(liveMarkers()).toHaveLength(0);
  });

  it.each([
    ['open', 'green', '#15803d', 'Beach: North Beach, open'],
    ['alert', 'yellow', '#a16207', 'Beach: North Beach, alert'],
    ['closed', 'red', '#dc2626', 'Beach: North Beach, closed'],
  ] as const)(
    'fills a %s beach by status with the Beaches ring',
    async (status, color, fill, label) => {
      fetchMock.mockResolvedValue([makeBeach({ status, color })]);
      render(<BeachLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
      await waitFor(() => expect(liveMarkers()).toHaveLength(1));
      const el = liveMarkers()[0]!.getElement();
      expect(el.style.getPropertyValue('--layer-color')).toBe('#115e59');
      expect(el.style.getPropertyValue('--marker-fill')).toBe(fill);
      expect(el.classList.contains('map-marker--status')).toBe(true);
      expect(el.getAttribute('aria-label')).toBe(label);
    },
  );

  it('greys out unmonitored and out-of-season beaches instead of showing them as current', async () => {
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    fetchMock.mockResolvedValue([
      makeBeach({ lastTested: '09/21/2026 11:45 AM' }),
      makeBeach({
        id: 'beach3',
        name: 'Lake Elmore',
        status: 'unknown',
        color: 'yellow',
        lastTested: null,
        waterQualityGrade: null,
        eColiLevel: null,
      }),
    ]);
    render(<BeachLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    for (const marker of liveMarkers()) {
      expect(marker.getElement().style.getPropertyValue('--marker-fill')).toBe('#64748b');
    }
    expect(liveMarkers()[0]!.getElement().getAttribute('aria-label')).toBe(
      'Beach: North Beach, season over',
    );
    expect(liveMarkers()[1]!.getElement().getAttribute('aria-label')).toBe(
      'Beach: Lake Elmore, not monitored',
    );
  });

  it('opens the clicked beach via onSelect, without a popup', async () => {
    const onSelect = vi.fn();
    render(<BeachLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[1]!.getElement());
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'beach2' }));
    expect(openPopups()).toHaveLength(0);
  });

  it('renders no markers when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<BeachLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('puts hostile upstream strings into the marker name as text, never markup', async () => {
    fetchMock.mockResolvedValue([makeBeach({ name: XSS_PAYLOAD, town: XSS_PAYLOAD })]);
    render(<BeachLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
