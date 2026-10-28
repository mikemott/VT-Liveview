import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FireDangerLayer from '../FireDangerLayer';
import FireDangerDetail from '../detail-views/FireDangerDetail';
import { areaView, fetchFireDanger, type FireDanger } from '../../services/fireDangerApi';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/fireDangerApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/fireDangerApi')>()),
  fetchFireDanger: vi.fn(),
}));
const fetchMock = vi.mocked(fetchFireDanger);

const square = (x: number, y: number) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [x, y],
      [x + 0.5, y],
      [x + 0.5, y + 0.5],
      [x, y + 0.5],
      [x, y],
    ],
  ],
});

const DANGER: FireDanger = {
  areas: [
    {
      id: '3',
      name: 'Champlain Valley',
      description: 'From the Champlain Islands, Swanton and Enosburg south to Brandon and Benson',
      rating: 4,
      labelLat: 44.4,
      labelLng: -73.1,
      geometry: square(-73.3, 44.2),
    },
    {
      id: '5',
      name: 'Northeast Kingdom',
      description: 'Newport, Lyndon, Island Pond and the rest of the Northeast Kingdom',
      rating: 2,
      labelLat: 44.7,
      labelLng: -72.0,
      geometry: square(-72.2, 44.5),
    },
  ],
  notes: 'Open burning is not advised.',
  preparedness: 3,
  updatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
};

beforeEach(() => {
  resetMaplibreMock();
  fetchMock.mockResolvedValue(DANGER);
});
afterEach(() => vi.clearAllMocks());

describe('FireDangerLayer (VTL-81)', () => {
  it('shades each area by rating and labels it with a marker', async () => {
    const fake = new FakeMap();
    const onLoaded = vi.fn();
    const onSelect = vi.fn();
    render(<FireDangerLayer map={fake.asMap()} visible onSelect={onSelect} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(onLoaded).toHaveBeenCalledWith(DANGER);
    expect(fake.layers.has('fire-danger-fill')).toBe(true);
    expect(fake.layers.has('fire-danger-outline')).toBe(true);

    const [champlain] = liveMarkers().map((m) => m.getElement());
    expect(champlain!.textContent?.trim()).toBe('Very High');
    expect(champlain!.style.getPropertyValue('--marker-fill')).toBe('#ea580c');
    expect(champlain!.getAttribute('aria-label')).toBe('Fire danger: Champlain Valley, very high');
    champlain!.click();
    expect(onSelect).toHaveBeenCalledWith(DANGER.areas[0], DANGER);
  });

  it('greys out ratings FPR hasn’t updated for days', async () => {
    fetchMock.mockResolvedValue({ ...DANGER, updatedAt: '2026-04-01T12:00:00Z' });
    const fake = new FakeMap();
    render(<FireDangerLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const el = liveMarkers()[0]!.getElement();
    expect(el.textContent?.trim()).toBe('Not current');
    expect(el.className).toContain('map-marker--dimmed');
  });

  it('waits for a style swap to finish before shading', async () => {
    const fake = new FakeMap();
    fake.styleLoaded = false;
    render(<FireDangerLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(fake.layers.has('fire-danger-fill')).toBe(false);
    fake.styleLoaded = true;
    fake.fire('idle');
    expect(fake.layers.has('fire-danger-fill')).toBe(true);
  });

  it('removes the shading when hidden', async () => {
    const fake = new FakeMap();
    const { rerender } = render(<FireDangerLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(fake.layers.has('fire-danger-fill')).toBe(true));
    rerender(<FireDangerLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} />);
    expect(fake.layers.has('fire-danger-fill')).toBe(false);
    expect(fake.sources.has('fire-danger-areas')).toBe(false);
    expect(liveMarkers()).toHaveLength(0);
  });
});

describe('FireDangerDetail', () => {
  it('shows the rating, what it means, the statewide notes and the burn permit rule', () => {
    render(<FireDangerDetail area={areaView(DANGER.areas[0]!, DANGER)} isDark={false} />);
    expect(screen.getByText('Fire danger · Area 3')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Very High');
    expect(screen.getByText(/spread rapidly and intensify quickly/)).toBeInTheDocument();
    expect(screen.getByText('Open burning is not advised.')).toBeInTheDocument();
    expect(screen.getByText(/permit from your town forest fire warden/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fire danger map/ })).toHaveAttribute(
      'href',
      'https://fpr.vermont.gov/forest/wildland-fire/monitoring-fire-danger',
    );
  });

  it('says when ratings are out of season', () => {
    render(
      <FireDangerDetail
        area={{ ...areaView(DANGER.areas[0]!, DANGER), updatedAt: '2026-04-01T12:00:00Z' }}
        isDark={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Not current');
    expect(screen.getByText(/March 20 to November 30/)).toBeInTheDocument();
    expect(screen.queryByText('Open burning is not advised.')).toBeNull();
  });
});
