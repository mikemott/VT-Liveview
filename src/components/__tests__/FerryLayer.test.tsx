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

const landings = () =>
  liveMarkers().filter((m) => !m.getElement().classList.contains('ferry-boat'));
const boats = () => liveMarkers().filter((m) => m.getElement().classList.contains('ferry-boat'));
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
    // Burlington is suspended: dimmed
    const burlington = landings()[FERRIES.findIndex((f) => f.id === 'burlington')]!.getElement();
    expect(burlington.className).toContain('map-marker--dimmed');
  });

  it('sails a small boat icon only on crossings in season', () => {
    const fake = new FakeMap();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    render(
      <FerryLayer map={fake.asMap()} visible isDark={false} onSelect={vi.fn()} now={JANUARY} />,
    );
    expect(raf).toHaveBeenCalled();
    // January: Grand Isle runs; Charlotte (ice), Fort Ti, the bike ferry, Island Runner and Burlington don't
    expect(boats()).toHaveLength(1);
    const boat = boats()[0]!;
    expect(boat.getLngLat()).toEqual(expect.objectContaining({ lng: FERRIES[0]!.route[0]![0] }));
    const el = boat.getElement();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('leaves the boats out for people who prefer reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const fake = new FakeMap();
    render(<FerryLayer map={fake.asMap()} visible isDark={false} onSelect={vi.fn()} now={JULY} />);
    expect(fake.layers.has('ferry-routes-line')).toBe(true);
    expect(boats()).toHaveLength(0);
  });

  it('cleans up when hidden', () => {
    const fake = new FakeMap();
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
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
    expect(cancel).toHaveBeenCalled();
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
