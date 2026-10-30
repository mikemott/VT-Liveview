import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FerryLayer from '../FerryLayer';
import FerryDetail from '../detail-views/FerryDetail';
import { FERRIES } from '../../data/ferries';
import { getFerryStatus } from '../../utils/ferries';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);

const JULY = new Date('2026-07-04T16:00:00Z');
const JANUARY = new Date('2026-01-15T16:00:00Z');

beforeEach(() => resetMaplibreMock());

const landings = liveMarkers;
afterEach(() => vi.restoreAllMocks());

describe('FerryLayer (VTL-81)', () => {
  it('draws every crossing with a marker at its Vermont landing', () => {
    const fake = new FakeMap();
    const onSelect = vi.fn();
    render(<FerryLayer map={fake.asMap()} visible isDark={false} onSelect={onSelect} now={JULY} />);
    expect(landings()).toHaveLength(FERRIES.length);
    expect(fake.layers.has('ferry-routes-line')).toBe(true);
    const grandIsle = landings()[0]!.getElement();
    expect(grandIsle.getAttribute('aria-label')).toBe(
      'Ferry: Grand Isle ferry, Grand Isle, VT ↔ Plattsburgh (Cumberland Head), NY, year-round',
    );
    grandIsle.click();
    expect(onSelect).toHaveBeenCalledWith(FERRIES[0], getFerryStatus(FERRIES[0]!, JULY));
  });

  it('dims crossings that are closed for the season', () => {
    const fake = new FakeMap();
    render(
      <FerryLayer map={fake.asMap()} visible isDark={false} onSelect={vi.fn()} now={JANUARY} />,
    );
    expect(landings()).toHaveLength(FERRIES.length);
    const marker = (id: string) => landings()[FERRIES.findIndex((f) => f.id === id)]!.getElement();
    expect(marker('bike-ferry').className).toContain('map-marker--dimmed');
    // Ice season isn't closed: Charlotte often runs
    expect(marker('charlotte').className).not.toContain('map-marker--dimmed');
    expect(marker('grand-isle').className).not.toContain('map-marker--dimmed');
  });

  it('cleans up when hidden', () => {
    const fake = new FakeMap();
    const { rerender } = render(
      <FerryLayer map={fake.asMap()} visible isDark={false} onSelect={vi.fn()} now={JULY} />,
    );
    rerender(
      <FerryLayer
        map={fake.asMap()}
        visible={false}
        isDark={false}
        onSelect={vi.fn()}
        now={JULY}
      />,
    );
    expect(fake.layers.size).toBe(0);
    expect(fake.sources.size).toBe(0);
    expect(liveMarkers()).toHaveLength(0);
  });
});

describe('FerryDetail', () => {
  it('shows the season, crossing time, notes, phone and operator link', () => {
    const fortTi = FERRIES.find((f) => f.id === 'fort-ticonderoga')!;
    render(
      <FerryDetail
        ferry={fortTi}
        status={getFerryStatus(fortTi, new Date('2026-10-28T16:00:00Z'))}
        isDark={false}
      />,
    );
    expect(screen.getByText('Car ferry')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('End of season: check before you go');
    expect(screen.getByText('About 7 minutes')).toBeInTheDocument();
    expect(screen.getByText(/Cash only/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /schedule and service alerts/ })).toHaveAttribute(
      'href',
      'https://forttiferry.com/',
    );
  });

  it('links the phone number when there is one', () => {
    const charlotte = FERRIES.find((f) => f.id === 'charlotte')!;
    render(
      <FerryDetail ferry={charlotte} status={getFerryStatus(charlotte, JANUARY)} isDark={false} />,
    );
    expect(screen.getByRole('link', { name: '802-864-9804' })).toHaveAttribute(
      'href',
      'tel:802-864-9804',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Ice season: often closed');
  });
});
