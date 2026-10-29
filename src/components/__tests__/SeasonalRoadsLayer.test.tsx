import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import SeasonalRoadsLayer, { SEASONAL_SOURCE_ID } from '../SeasonalRoadsLayer';
import SeasonalRoadDetail from '../detail-views/SeasonalRoadDetail';
import { SEASONAL_ROADS } from '../../data/seasonalRoads';
import type { SeasonalRoadFeatureCollection } from '../../utils/seasonalRoads';
import { FakeMap } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);

const WINTER = new Date('2027-01-15T15:00:00Z');
const SUMMER = new Date('2026-07-04T15:00:00Z');

function statusOf(fake: FakeMap, id: string): string | undefined {
  const data = fake.getSource(SEASONAL_SOURCE_ID)?.data as SeasonalRoadFeatureCollection;
  return data.features.find((f) => f.properties.id === id)?.properties.status;
}

const baseProps = {
  isDark: false,
  mapStyleVersion: 0,
  closures: [] as { lat: number; lng: number }[],
  onRoadClick: vi.fn(),
};

describe('SeasonalRoadsLayer', () => {
  it('adds nothing while hidden', () => {
    const fake = new FakeMap();
    render(<SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible={false} now={WINTER} />);
    expect(fake.sources.size).toBe(0);
    expect(fake.layers.size).toBe(0);
  });

  it('draws every road, closed in winter, and cleans up on hide', () => {
    const fake = new FakeMap();
    const { rerender } = render(
      <SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible now={WINTER} />,
    );
    expect(fake.errors).toEqual([]);
    const data = fake.getSource(SEASONAL_SOURCE_ID)?.data as SeasonalRoadFeatureCollection;
    expect(data.features).toHaveLength(SEASONAL_ROADS.length);
    expect(statusOf(fake, 'smugglers-notch')).toBe('seasonal');

    rerender(<SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible={false} now={WINTER} />);
    expect(fake.errors).toEqual([]);
    expect(fake.layers.size).toBe(0);
    expect(fake.sources.size).toBe(0);
    expect(fake.listeners.filter((l) => l.layerId)).toHaveLength(0);
  });

  it('waits for the style after a context loss or style swap (VTL-81)', () => {
    const fake = new FakeMap();
    fake.styleLoaded = false;
    const { rerender } = render(
      <SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible now={WINTER} />,
    );
    expect(fake.sources.size).toBe(0);
    fake.styleLoaded = true;
    fake.fire('idle');
    expect(fake.errors).toEqual([]);
    expect(fake.getSource(SEASONAL_SOURCE_ID)).toBeTruthy();

    // Hidden before the style settles: nothing is added later
    fake.styleLoaded = false;
    rerender(<SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible={false} now={WINTER} />);
    rerender(<SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible now={WINTER} />);
    rerender(<SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible={false} now={WINTER} />);
    fake.styleLoaded = true;
    fake.fire('idle');
    expect(fake.sources.size).toBe(0);
  });

  it('a 511 closure overrides an open road', () => {
    const fake = new FakeMap();
    const lincoln = SEASONAL_ROADS.find((r) => r.id === 'lincoln-gap')!;
    const [lng, lat] = lincoln.lines[0]![0]!;
    const { rerender } = render(
      <SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible now={SUMMER} />,
    );
    expect(statusOf(fake, 'lincoln-gap')).toBe('open');
    rerender(
      <SeasonalRoadsLayer
        {...baseProps}
        map={fake.asMap()}
        visible
        now={SUMMER}
        closures={[{ lat, lng }]}
      />,
    );
    expect(statusOf(fake, 'lincoln-gap')).toBe('closed511');
    expect(statusOf(fake, 'kelley-stand')).toBe('open');
  });

  it('reports the clicked road with its status', () => {
    const fake = new FakeMap();
    const onRoadClick = vi.fn();
    render(
      <SeasonalRoadsLayer
        {...baseProps}
        onRoadClick={onRoadClick}
        map={fake.asMap()}
        visible
        now={WINTER}
      />,
    );
    fake.fire(
      'click',
      { features: [{ properties: { id: 'hazens-notch' } }] },
      'seasonal-roads-hit',
    );
    expect(onRoadClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'hazens-notch' }),
      expect.objectContaining({ status: 'seasonal' }),
    );
  });

  it('updates statuses when the Vermont date rolls over', async () => {
    vi.useFakeTimers();
    try {
      // 23:55 EST on Nov 14: Smugglers' Notch closes Nov 15
      vi.setSystemTime(new Date('2026-11-15T04:55:00Z'));
      const fake = new FakeMap();
      render(<SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible />);
      expect(statusOf(fake, 'smugglers-notch')).toBe('closingSoon');
      await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000));
      expect(statusOf(fake, 'smugglers-notch')).toBe('seasonal');
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-adds its layers after a style swap', () => {
    const fake = new FakeMap();
    const { rerender } = render(
      <SeasonalRoadsLayer {...baseProps} map={fake.asMap()} visible now={WINTER} />,
    );
    fake.setStyle({});
    rerender(
      <SeasonalRoadsLayer
        {...baseProps}
        mapStyleVersion={1}
        map={fake.asMap()}
        visible
        now={WINTER}
      />,
    );
    expect(fake.errors).toEqual([]);
    expect(fake.getSource(SEASONAL_SOURCE_ID)).toBeDefined();
    expect(fake.layers.size).toBe(4);
  });
});

describe('SeasonalRoadDetail', () => {
  it('shows status, typical dates and source links', () => {
    const road = SEASONAL_ROADS.find((r) => r.id === 'smugglers-notch')!;
    render(
      <SeasonalRoadDetail
        road={road}
        status={{ status: 'seasonal', label: 'Seasonally closed, usually until about May 25' }}
        isDark={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Seasonally closed');
    expect(screen.getByText(/Nov 15 – May 25/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Vermont Public/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
