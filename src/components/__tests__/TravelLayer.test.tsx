import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import TravelLayer from '../TravelLayer';
import { fetchAllIncidents, fetchAllIncidentsWithStatus } from '../../services/travelApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeVT511Incident } from '../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';
import { INTERVALS } from '../../utils/constants';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/travelApi', () => ({
  fetchAllIncidents: vi.fn(),
  fetchAllIncidentsWithStatus: vi.fn(),
}));
// The stargazing panel is covered by its own test; keep it out of this one.
vi.mock('../StargazingLayer', () => ({
  default: () => <div data-testid="stargazing-panel" />,
}));

// Most tests drive fetchMock (incident list); statusMock wraps it and reports
// every source as available unless a test overrides it.
const fetchMock = vi.mocked(fetchAllIncidents);
const statusMock = vi.mocked(fetchAllIncidentsWithStatus);

type Props = ComponentProps<typeof TravelLayer>;

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const LINE = {
  type: 'LineString' as const,
  coordinates: [
    [-72.6, 44.3],
    [-72.5, 44.4],
  ] as [number, number][],
};

describe('TravelLayer', () => {
  let fake: FakeMap;
  let props: Props;

  beforeEach(() => {
    statusMock.mockImplementation(async () => ({
      incidents: await fetchMock(),
      unavailableSources: [],
    }));
    fake = new FakeMap({ zoom: 10 });
    fetchMock.mockResolvedValue([
      makeVT511Incident(),
      makeVT511Incident({ id: 'vt511-2', title: 'Crash on US-7', geometry: LINE }),
      makeVT511Incident({
        id: 'vt511-3',
        type: 'CONSTRUCTION',
        title: 'Paving',
        severity: 'MODERATE',
      }),
    ]);
    const noop = vi.fn();
    props = {
      map: fake.asMap(),
      visible: true,
      currentZoom: 10,
      isDark: false,
      showWeatherStations: false,
      onToggleWeatherStations: noop,
      showSkiResorts: false,
      onToggleSkiResorts: noop,
      showCreemeeStands: false,
      onToggleCreemeeStands: noop,
      showCampingSites: false,
      onToggleCampingSites: noop,
      showCampgrounds: false,
      onToggleCampgrounds: noop,
      showBackcountrySites: false,
      onToggleBackcountrySites: noop,
      campgroundCount: 0,
      backcountryCount: 0,
      showBeachSites: false,
      onToggleBeachSites: noop,
      showStargazing: false,
      onToggleStargazing: noop,
      showTrafficFlow: false,
      onToggleTrafficFlow: noop,
      globalPopupRef: { current: null },
      mapStyleVersion: 0,
    };
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.useRealTimers();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds markers for active incident types and removes everything on unmount', async () => {
    const { unmount } = render(<TravelLayer {...props} />);
    // Only ACCIDENT is enabled by default
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(fake.listenerCount('click')).toBe(1);

    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

    // Select the route incident so highlight layers exist
    fireEvent.click(screen.getByText('Crash on US-7'));
    expect(fake.layerIds()).toEqual(['incident-highlight-outline', 'incident-highlight']);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(props.globalPopupRef.current).toBeNull();
    expect(fake.listenerCount()).toBe(0);
    expect(fake.layerIds()).toEqual([]);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.errors).toEqual([]);
  });

  it('removes markers, popup and listener when hidden, and renders no panel', async () => {
    const { rerender, container } = render(<TravelLayer {...props} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[0]!.getElement());

    rerender(<TravelLayer {...props} visible={false} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(fake.listenerCount()).toBe(0);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading skeleton, then the incident list', async () => {
    let resolve: (v: Awaited<ReturnType<typeof fetchAllIncidents>>) => void = () => {};
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = render(<TravelLayer {...props} />);
    expect(container.querySelector('.incidents-skeleton')).not.toBeNull();

    await act(async () => {
      resolve([makeVT511Incident()]);
      await Promise.resolve();
    });
    expect(container.querySelector('.incidents-skeleton')).toBeNull();
    expect(screen.getByText('Crash on I-89')).toBeInTheDocument();
    expect(screen.getByText(/^Updated/)).toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    fetchMock.mockResolvedValue([]);
    render(<TravelLayer {...props} />);
    expect(await screen.findByText('No travel incidents reported')).toBeInTheDocument();
  });

  // VTL-57: an outage must never read as "no incidents"
  it('does not show the empty state alongside an error', async () => {
    fetchMock.mockRejectedValue(new Error('VT 511 unavailable'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TravelLayer {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load incidents');
    expect(screen.queryByText('No travel incidents reported')).toBeNull();
    spy.mockRestore();
  });

  it('does not claim "no incidents" when loaded incidents are only hidden by filters', async () => {
    // Default filters show accidents only; this feed has only construction
    fetchMock.mockResolvedValue([makeVT511Incident({ type: 'CONSTRUCTION', title: 'Paving' })]);
    render(<TravelLayer {...props} />);
    expect(
      await screen.findByText('No incidents match the current filters or zoom level'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No travel incidents reported')).toBeNull();
  });

  it('flags a partial outage and avoids claiming the roads are clear', async () => {
    statusMock.mockResolvedValue({ incidents: [], unavailableSources: ['VT 511 incidents'] });
    render(<TravelLayer {...props} />);
    expect(
      await screen.findByText(/VT 511 incidents unavailable right now\. Showing what loaded\./),
    ).toBeInTheDocument();
    expect(screen.getByText('No incidents in the data that loaded')).toBeInTheDocument();
    expect(screen.queryByText('No travel incidents reported')).toBeNull();
  });

  it('shows the error state and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('VT 511 unavailable'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TravelLayer {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('VT 511 unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading incidents' }));
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('refreshes incidents on the polling interval and stops on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { unmount } = render(<TravelLayer {...props} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => {
      vi.advanceTimersByTime(INTERVALS.INCIDENTS_REFRESH);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    unmount();
    vi.advanceTimersByTime(INTERVALS.INCIDENTS_REFRESH * 3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('toggles filter chips to show other incident types', async () => {
    render(<TravelLayer {...props} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const chip = screen.getByRole('button', { name: /Construction/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(liveMarkers()).toHaveLength(3));
    expect(screen.getByText('Paving')).toBeInTheDocument();
  });

  it('hides lower-severity incidents when zoomed out and shows a zoom hint', async () => {
    render(<TravelLayer {...props} currentZoom={7} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText('Zoom in to see more incidents')).toBeInTheDocument();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('highlights a route incident and toggles the highlight off again', async () => {
    render(<TravelLayer {...props} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    fireEvent.click(screen.getByText('Crash on US-7'));
    expect(fake.sourceIds()).toEqual(['incident-highlight']);
    expect(fake.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Crash on US-7'));
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
  });

  it('flies to point incidents and replaces a previous highlight', async () => {
    render(<TravelLayer {...props} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    fireEvent.click(screen.getByText('Crash on US-7'));
    fireEvent.click(screen.getByText('Crash on I-89'));
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-72.6, 44.3], zoom: 13 }),
    );
  });

  it('toggles a marker popup and closes it on map click', async () => {
    render(<TravelLayer {...props} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const el = liveMarkers()[0]!.getElement();
    click(el);
    click(el);
    expect(openPopups()).toHaveLength(0);
    click(el);
    click(liveMarkers()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    fake.fire('click');
    expect(openPopups()).toHaveLength(0);
  });

  it('collapses the panel and forwards the layer chip toggles', async () => {
    const onToggleSkiResorts = vi.fn();
    const onToggleTrafficFlow = vi.fn();
    render(
      <TravelLayer
        {...props}
        onToggleSkiResorts={onToggleSkiResorts}
        onToggleTrafficFlow={onToggleTrafficFlow}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Ski Resorts/ }));
    fireEvent.click(screen.getByRole('button', { name: /Traffic/ }));
    expect(onToggleSkiResorts).toHaveBeenCalledTimes(1);
    expect(onToggleTrafficFlow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse map features' }));
    expect(screen.queryByText('Points of Interest')).toBeNull();
  });

  it('swaps the incident list for the camping and stargazing panels', async () => {
    const { rerender } = render(<TravelLayer {...props} showCampingSites />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText('Camping & Outdoor Recreation')).toBeInTheDocument();
    expect(screen.queryByText('No travel incidents reported')).toBeNull();

    rerender(<TravelLayer {...props} showStargazing />);
    expect(screen.getByTestId('stargazing-panel')).toBeInTheDocument();
  });

  it.todo(
    'keeps incident markers and the open popup when zoom changes within a threshold bucket (FINDINGS C2)',
  );
  it.todo('incident list items and section header are keyboard accessible (FINDINGS H15)');

  it('escapes hostile upstream strings in popup HTML', async () => {
    fetchMock.mockResolvedValue([
      makeVT511Incident({
        title: XSS_PAYLOAD,
        description: XSS_PAYLOAD,
        roadName: XSS_PAYLOAD,
        source: XSS_PAYLOAD as 'VT 511',
        startTime: XSS_PAYLOAD,
      }),
    ]);
    render(<TravelLayer {...props} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());
    const html = openPopups()[0]?.html ?? '';
    expectNoInjectedMarkup(html);
    expectPayloadAsText(html);
  });
});
