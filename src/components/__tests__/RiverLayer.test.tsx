import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RiverLayer from '../RiverLayer';
import RiverDetail from '../detail-views/RiverDetail';
import { fetchRiverGauges, type RiverGauge, type RiverGaugeDetail } from '../../services/riverApi';
import { useRiverGauge } from '../../hooks/useRiverGauge';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/riverApi', () => ({ fetchRiverGauges: vi.fn() }));
vi.mock('../../hooks/useRiverGauge', () => ({ useRiverGauge: vi.fn() }));
const fetchMock = vi.mocked(fetchRiverGauges);
const useRiverGaugeMock = vi.mocked(useRiverGauge);

const recent = new Date(Date.now() - 20 * 60_000).toISOString();
const hoursFromNow = (h: number): string => new Date(Date.now() + h * 3600_000).toISOString();

const GAUGES: RiverGauge[] = [
  {
    id: 'ESSV1',
    name: 'Winooski River at Essex Junction',
    state: 'VT',
    lat: 44.49,
    lng: -73.11,
    stageFt: 12.4,
    flowCfs: 9800,
    category: 'action',
    observedAt: recent,
    forecastCategory: 'minor',
    forecastStageFt: 14.8,
    forecastAt: hoursFromNow(6),
  },
  {
    id: 'ARLV1',
    name: 'Battenkill at Arlington',
    state: 'VT',
    lat: 43.07,
    lng: -73.15,
    stageFt: null,
    flowCfs: null,
    category: 'unknown',
    observedAt: null,
    forecastCategory: null,
    forecastStageFt: null,
    forecastAt: null,
  },
];

const DETAIL: RiverGaugeDetail = {
  id: 'ESSV1',
  usgsId: '04290500',
  county: 'Chittenden',
  floodStages: { action: 12, minor: 14, moderate: 16, major: 18 },
  impacts: [
    { stageFt: 16, statement: 'Route 117 floods near the Essex line.' },
    { stageFt: 14, statement: 'Low-lying fields along the river flood.' },
  ],
  historicCrests: [{ date: '2023-07-11', stageFt: 19.6, flowCfs: 30000 }],
  observed: [
    { t: hoursFromNow(-6), stageFt: 10.1 },
    { t: hoursFromNow(-3), stageFt: 11.5 },
    { t: recent, stageFt: 12.4 },
  ],
  forecast: [
    { t: hoursFromNow(6), stageFt: 14.8 },
    { t: hoursFromNow(12), stageFt: 13.9 },
  ],
  forecastIssuedAt: recent,
};

beforeEach(() => {
  resetMaplibreMock();
  fetchMock.mockResolvedValue(GAUGES);
  useRiverGaugeMock.mockReturnValue({ data: DETAIL, isError: false } as unknown as ReturnType<
    typeof useRiverGauge
  >);
});
afterEach(() => vi.clearAllMocks());

describe('RiverLayer (VTL-81)', () => {
  it('loads while hidden (for search) but adds markers only when visible', async () => {
    const fake = new FakeMap();
    const onLoaded = vi.fn();
    const { rerender } = render(
      <RiverLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(GAUGES));
    expect(liveMarkers()).toHaveLength(0);
    rerender(<RiverLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    expect(liveMarkers()).toHaveLength(2);
  });

  it('colors gauges by the worse of observed and forecast, dims those without a reading', async () => {
    const fake = new FakeMap();
    const onSelect = vi.fn();
    render(<RiverLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [essex, arlington] = liveMarkers().map((m) => m.getElement());
    expect(essex!.dataset.layer).toBe('riverGauges');
    expect(essex!.className).toContain('flood-minor');
    expect(essex!.style.getPropertyValue('--marker-fill')).toBe('#ea580c');
    expect(essex!.getAttribute('aria-label')).toBe(
      'River gauge: Winooski River at Essex Junction, 12.40 ft, action stage; forecast minor flooding',
    );
    expect(arlington!.className).toContain('stale');
    expect(arlington!.style.getPropertyValue('--marker-fill')).toBe('');
    expect(arlington!.getAttribute('aria-label')).toBe(
      'River gauge: Battenkill at Arlington, no current reading',
    );
    essex!.click();
    expect(onSelect).toHaveBeenCalledWith(GAUGES[0]);
  });
});

describe('RiverDetail', () => {
  it('shows the stage, forecast warning, flood stage, impact, hydrograph and crests', () => {
    render(<RiverDetail gauge={GAUGES[0]!} isDark={false} />);
    const [headline, warning] = screen.getAllByRole('status');
    expect(headline).toHaveTextContent('12.40');
    expect(headline).toHaveTextContent('Action stage');
    expect(warning).toHaveTextContent('Forecast: minor flooding, cresting near 14.80 ft');
    expect(screen.getByText('14.00 ft (1.6 ft below)')).toBeInTheDocument();
    expect(screen.getByText('At 14.00 ft')).toBeInTheDocument();
    expect(screen.getByText('Low-lying fields along the river flood.')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /dashed line is the NWS forecast; flood stage 14.00 ft/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Jul 11, 2023')).toBeInTheDocument();
    expect(screen.getByText(/Chittenden County, VT/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Full forecast' })).toHaveAttribute(
      'href',
      'https://water.noaa.gov/gauges/ESSV1',
    );
  });

  it('copes with no reading and no detail', () => {
    useRiverGaugeMock.mockReturnValue({ data: undefined, isError: true } as unknown as ReturnType<
      typeof useRiverGauge
    >);
    render(<RiverDetail gauge={GAUGES[1]!} isDark={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('No current reading');
    expect(screen.getByText(/Couldn’t load this gauge’s history/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
