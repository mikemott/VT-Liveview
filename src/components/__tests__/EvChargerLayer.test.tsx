import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import EvChargerLayer from '../EvChargerLayer';
import { describePorts } from '../../utils/evChargers';
import EvChargerDetail from '../detail-views/EvChargerDetail';
import { fetchEvChargers, type EvCharger } from '../../services/evChargerApi';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/evChargerApi', () => ({ fetchEvChargers: vi.fn() }));
const fetchMock = vi.mocked(fetchEvChargers);

const STATIONS: EvCharger[] = [
  {
    id: '102480',
    name: 'Berlin, VT - Tesla Supercharger',
    address: '213 Payne Turnpike',
    city: 'Berlin',
    lat: 44.2125,
    lng: -72.5764,
    network: 'Tesla',
    networkUrl: 'https://www.tesla.com/supercharger',
    dcFastPorts: 8,
    level2Ports: 0,
    maxKw: 150,
    connectors: ['NACS (Tesla)'],
    hours: '24 hours daily. Open to Teslas only.',
    pricing: null,
    facility: 'Hotel',
    lastConfirmed: '2026-06-18',
  },
  {
    id: '27036',
    name: 'Burlington International Airport',
    address: '1200 Airport Dr',
    city: 'South Burlington',
    lat: 44.4697,
    lng: -73.1531,
    network: null,
    networkUrl: null,
    dcFastPorts: 0,
    level2Ports: 6,
    maxKw: null,
    connectors: ['J1772', 'NEMA 5-20'],
    hours: '24 hours daily',
    pricing: 'Pay lot',
    facility: 'Airport',
    lastConfirmed: null,
  },
];

beforeEach(() => {
  resetMaplibreMock();
  fetchMock.mockResolvedValue(STATIONS);
});
afterEach(() => vi.clearAllMocks());

describe('EvChargerLayer (VTL-81)', () => {
  it('describes ports', () => {
    expect(describePorts(STATIONS[0]!)).toBe('8 DC fast (150 kW)');
    expect(describePorts(STATIONS[1]!)).toBe('6 Level 2');
    expect(describePorts({ ...STATIONS[0]!, level2Ports: 2, maxKw: null })).toBe(
      '8 DC fast, 2 Level 2',
    );
  });

  it('shows DC fast chargers statewide and Level 2 from town zoom', async () => {
    const fake = new FakeMap();
    fake.zoom = 8;
    const onLoaded = vi.fn();
    render(<EvChargerLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(STATIONS));
    expect(liveMarkers()).toHaveLength(1);
    const fast = liveMarkers()[0]!.getElement();
    expect(fast.textContent?.trim()).toBe('150 kW');
    expect(fast.className).toContain('ev-fast');
    expect(fast.getAttribute('aria-label')).toBe(
      'EV charger: Berlin, VT - Tesla Supercharger, 8 DC fast (150 kW), Tesla',
    );

    fake.zoom = 12;
    act(() => fake.fire('zoomend'));
    expect(liveMarkers()).toHaveLength(2);
    expect(liveMarkers()[1]!.getElement().getAttribute('aria-label')).toBe(
      'EV charger: Burlington International Airport, 6 Level 2',
    );

    fake.zoom = 9;
    act(() => fake.fire('zoomend'));
    expect(liveMarkers()).toHaveLength(1);
  });

  it('adds no markers while hidden and reports clicks', async () => {
    const fake = new FakeMap();
    const onSelect = vi.fn();
    const { rerender } = render(
      <EvChargerLayer map={fake.asMap()} visible={false} onSelect={onSelect} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    rerender(<EvChargerLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    liveMarkers()[0]!.getElement().click();
    expect(onSelect).toHaveBeenCalledWith(STATIONS[0]);
  });
});

describe('EvChargerDetail', () => {
  it('shows ports, network, hours, connectors and links', () => {
    render(<EvChargerDetail station={STATIONS[0]!} isDark={false} />);
    expect(screen.getByText('DC fast charger')).toBeInTheDocument();
    expect(screen.getByText('213 Payne Turnpike, Berlin')).toBeInTheDocument();
    expect(screen.getByText('8 DC fast (150 kW)')).toBeInTheDocument();
    expect(screen.getByText('24 hours daily. Open to Teslas only.')).toBeInTheDocument();
    expect(screen.getByText('NACS (Tesla)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Directions/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=44.2125,-72.5764',
    );
    expect(screen.getByRole('link', { name: /Tesla availability/ })).toHaveAttribute(
      'href',
      'https://www.tesla.com/supercharger',
    );
    expect(screen.getByText(/last confirmed Jun 18, 2026/)).toBeInTheDocument();
  });

  it('handles a non-networked Level 2 station', () => {
    render(<EvChargerDetail station={STATIONS[1]!} isDark={false} />);
    expect(screen.getByText('Level 2 charger')).toBeInTheDocument();
    expect(screen.getByText('Not networked')).toBeInTheDocument();
    expect(screen.getByText('Pay lot')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /availability/ })).toBeNull();
  });
});
