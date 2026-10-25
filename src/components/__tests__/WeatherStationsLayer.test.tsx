import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import WeatherStationsLayer from '../WeatherStationsLayer';
import { server } from '../../test/msw';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeStation } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';
import type { ObservationStation } from '../../types';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);

function useStations(stations: ObservationStation[]): void {
  server.use(
    graphql.query('GetObservationStations', () =>
      HttpResponse.json({ data: { observationStations: stations } }),
    ),
  );
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('WeatherStationsLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    // Fixture readings are from 12:00Z; keep them fresh (30 min old)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:30:00Z'));
    fake = new FakeMap();
    useStations([
      makeStation(),
      makeStation({ id: 'USGS-04282500', name: 'Otter Creek water temp' }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMaplibreMock();
    delete window.__xss;
  });

  it('adds markers in the Stations color, and removes them on unmount', async () => {
    const { unmount } = render(
      <WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const el = liveMarkers()[0]!.getElement();
    expect(el.style.getPropertyValue('--layer-color')).toBe('#2563eb');
    // Side panel only: no popups, no map-level click listener (VTL-64)
    click(el);
    expect(openPopups()).toHaveLength(0);
    expect(fake.listenerCount('click')).toBe(0);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(fake.listenerCount()).toBe(0);
  });

  it('removes markers when hidden', async () => {
    const { rerender } = render(
      <WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    rerender(<WeatherStationsLayer map={fake.asMap()} visible={false} onStationClick={vi.fn()} />);
    expect(liveMarkers()).toHaveLength(0);
  });

  it('reports loaded stations so a shared selection can be restored (VTL-52)', async () => {
    const onStationsLoaded = vi.fn();
    render(
      <WeatherStationsLayer
        map={fake.asMap()}
        visible
        onStationClick={vi.fn()}
        onStationsLoaded={onStationsLoaded}
      />,
    );
    await waitFor(() => expect(onStationsLoaded).toHaveBeenCalledTimes(1));
    expect(onStationsLoaded.mock.calls[0]![0]).toHaveLength(2);
  });

  it('calls onStationClick with the clicked station', async () => {
    const onStationClick = vi.fn();
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={onStationClick} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[1]!.getElement());
    expect(onStationClick).toHaveBeenCalledTimes(1);
    expect(onStationClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'USGS-04282500' }));
  });

  it('makes markers keyboard-operable with a name that leads with the visible reading (FINDINGS H15)', async () => {
    const onStationClick = vi.fn();
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={onStationClick} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [air, water] = liveMarkers().map((m) => m.getElement());

    expect(air).toHaveAttribute('aria-label', '45°, Barre-Montpelier Airport');
    expect(air!.getAttribute('aria-label')).toContain(air!.textContent?.trim());
    expect(water).toHaveAttribute('aria-label', '45° water temperature, Otter Creek water temp');
    expect(air!.tabIndex).toBe(0);

    air!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onStationClick).toHaveBeenCalledTimes(1);
    water!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onStationClick).toHaveBeenCalledTimes(2);
    air!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(onStationClick).toHaveBeenCalledTimes(2);
  });

  // VTL-50: old readings must not look like current conditions
  it('dims stale readings and says how old they are', async () => {
    vi.setSystemTime(new Date('2026-10-16T16:20:00Z')); // fixture is ~4 hours old
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const air = liveMarkers()[0]!.getElement();
    expect(air.classList.contains('stale')).toBe(true);
    expect(air.classList.contains('map-marker--dimmed')).toBe(true);
    expect(air.getAttribute('aria-label')).toBe(
      '45°, Barre-Montpelier Airport, reading from 4 hr ago',
    );
  });

  it('shows 0° as a value and N/A when there is no reading', async () => {
    const base = makeStation();
    useStations([
      makeStation({ weather: { ...base.weather, temperature: 0 } }),
      makeStation({ id: 'KX', weather: { ...base.weather, temperature: Number.NaN } }),
    ]);
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]!.getElement().textContent).toBe('0°');
    expect(liveMarkers()[1]!.getElement().textContent).toBe('N/A');
  });

  it('renders the water-temperature marker with a static droplet icon', async () => {
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const water = liveMarkers()[1]!.getElement();
    expect(water.querySelector('svg path')).not.toBeNull();
    expect(water.textContent).toContain('45°');
  });

  it('keeps rendering nothing when the request fails', async () => {
    server.use(
      graphql.query('GetObservationStations', () =>
        HttpResponse.json({ errors: [{ message: 'down' }] }),
      ),
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('puts hostile upstream strings into markers as text, never markup', async () => {
    const base = makeStation();
    useStations([
      makeStation({ id: XSS_PAYLOAD, name: XSS_PAYLOAD, weather: { ...base.weather } }),
    ]);
    render(<WeatherStationsLayer map={fake.asMap()} visible onStationClick={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
