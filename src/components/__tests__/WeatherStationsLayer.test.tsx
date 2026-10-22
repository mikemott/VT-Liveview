import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import type maplibregl from 'maplibre-gl';
import WeatherStationsLayer from '../WeatherStationsLayer';
import { server } from '../../test/msw';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeStation } from '../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';
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

function popupRef(): React.MutableRefObject<maplibregl.Popup | null> {
  return { current: null };
}

describe('WeatherStationsLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    useStations([
      makeStation(),
      makeStation({ id: 'USGS-04282500', name: 'Otter Creek water temp' }),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    delete window.__xss;
  });

  it('adds markers and a map click listener, and removes everything on unmount', async () => {
    const ref = popupRef();
    const { unmount } = render(
      <WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={ref} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(fake.listenerCount('click')).toBe(1);

    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);
    expect(ref.current).not.toBeNull();

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(ref.current).toBeNull();
    expect(fake.listenerCount()).toBe(0);
  });

  it('removes markers and the popup when hidden', async () => {
    const ref = popupRef();
    const { rerender } = render(
      <WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={ref} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[0]!.getElement());

    rerender(<WeatherStationsLayer map={fake.asMap()} visible={false} globalPopupRef={ref} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(fake.listenerCount()).toBe(0);
  });

  it('toggles the popup on repeated clicks and closes it on map click', async () => {
    const ref = popupRef();
    render(<WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={ref} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const el = liveMarkers()[0]!.getElement();

    click(el);
    expect(openPopups()).toHaveLength(1);
    click(el);
    expect(openPopups()).toHaveLength(0);

    click(el);
    click(liveMarkers()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    expect(openPopups()[0]?.html).toContain('Water Temperature');

    fake.fire('click');
    expect(openPopups()).toHaveLength(0);
    expect(ref.current).toBeNull();
  });

  it('calls onStationClick with the clicked station', async () => {
    const onStationClick = vi.fn();
    render(
      <WeatherStationsLayer
        map={fake.asMap()}
        visible
        globalPopupRef={popupRef()}
        onStationClick={onStationClick}
      />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[1]!.getElement());
    expect(onStationClick).toHaveBeenCalledTimes(1);
    expect(onStationClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'USGS-04282500' }));
  });

  it('makes markers keyboard-operable with a name that leads with the visible reading (FINDINGS H15)', async () => {
    const onStationClick = vi.fn();
    render(
      <WeatherStationsLayer
        map={fake.asMap()}
        visible
        globalPopupRef={popupRef()}
        onStationClick={onStationClick}
      />,
    );
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

  it('shows 0°F and 0% as values, not N/A', async () => {
    const base = makeStation();
    useStations([makeStation({ weather: { ...base.weather, temperature: 0, humidity: 0 } })]);
    render(<WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={popupRef()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    expect(liveMarkers()[0]!.getElement().textContent).toBe('0°');

    click(liveMarkers()[0]!.getElement());
    const text = openPopups()[0]?.getElement().textContent ?? '';
    expect(text).toMatch(/Temperature\s*0°F/);
    expect(text).toMatch(/Humidity\s*0%/);
    expect(text).toMatch(/Pressure\s*1013\.25 mb/);
    expect(text).toContain('Elevation: 1,165 ft');
  });

  it('shows N/A for missing readings', async () => {
    const base = makeStation();
    useStations([
      makeStation({
        elevation: null,
        weather: {
          ...base.weather,
          temperature: Number.NaN,
          windSpeed: null,
          humidity: null,
          pressure: null,
        },
      }),
    ]);
    render(<WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={popupRef()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    expect(liveMarkers()[0]!.getElement().textContent).toBe('N/A');
    click(liveMarkers()[0]!.getElement());
    const text = openPopups()[0]?.getElement().textContent ?? '';
    expect(text).toMatch(/Wind\s*N\/A/);
    expect(text).not.toContain('Elevation');
  });

  it('renders the water-temperature marker with a static droplet icon', async () => {
    render(<WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={popupRef()} />);
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
    render(<WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={popupRef()} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('escapes hostile upstream strings in popup HTML', async () => {
    const base = makeStation();
    useStations([
      makeStation({
        id: XSS_PAYLOAD,
        name: XSS_PAYLOAD,
        weather: {
          ...base.weather,
          windSpeed: XSS_PAYLOAD,
          windDirection: XSS_PAYLOAD,
          description: XSS_PAYLOAD,
          temperatureUnit: XSS_PAYLOAD,
          timestamp: XSS_PAYLOAD,
        },
      }),
    ]);
    render(<WeatherStationsLayer map={fake.asMap()} visible globalPopupRef={popupRef()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());

    const html = openPopups()[0]?.html ?? '';
    expectNoInjectedMarkup(html);
    expectPayloadAsText(html);
    expectNoInjectedMarkup(liveMarkers()[0]!.getElement());
  });
});
