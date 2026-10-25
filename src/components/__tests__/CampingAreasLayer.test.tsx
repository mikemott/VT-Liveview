import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CampingAreasLayer from '../CampingAreasLayer';
import { fetchCampingAreas } from '../../services/campingApi';
import {
  FakeMap,
  FakeSource,
  liveMarkers,
  openPopups,
  resetMaplibreMock,
} from '../../test/maplibreMock';
import { makeCampingArea, omit } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/campingApi', () => ({ fetchCampingAreas: vi.fn() }));

const fetchMock = vi.mocked(fetchCampingAreas);
const SOURCE = 'camping-area-boundaries';
const LAYERS = ['camping-area-boundaries-fill', 'camping-area-boundaries-outline'];

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('CampingAreasLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchMock.mockResolvedValue([
      makeCampingArea(),
      omit(
        makeCampingArea({
          id: 'a2',
          name: 'Little River State Park',
          type: 'state_park',
          siteCount: 1,
        }),
        'boundary',
      ),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds boundary source/layers and markers, and removes all of them on unmount', async () => {
    const onLoaded = vi.fn();
    const { unmount } = render(
      <CampingAreasLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledWith({ minSites: 1, includeBoundaries: true });
    expect(onLoaded).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a1' }),
      expect.objectContaining({ id: 'a2' }),
    ]);
    expect(fake.sourceIds()).toEqual([SOURCE]);
    expect(fake.layerIds()).toEqual(LAYERS);
    // Only areas with a boundary become polygons
    const data = fake.getSource<FakeSource>(SOURCE)?.data as { features: unknown[] };
    expect(data.features).toHaveLength(1);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
    expect(fake.errors).toEqual([]);
  });

  it('removes layers and markers when hidden', async () => {
    const { rerender } = render(
      <CampingAreasLayer map={fake.asMap()} visible onSelect={vi.fn()} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    rerender(<CampingAreasLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
  });

  it('does not fetch while hidden', () => {
    render(<CampingAreasLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('re-adds boundary layers after a style swap (mapStyleVersion bump)', async () => {
    const { rerender } = render(
      <CampingAreasLayer map={fake.asMap()} visible mapStyleVersion={1} onSelect={vi.fn()} />,
    );
    await waitFor(() => expect(fake.layerIds()).toEqual(LAYERS));
    fake.setStyle({});
    expect(fake.layerIds()).toEqual([]);
    rerender(
      <CampingAreasLayer map={fake.asMap()} visible mapStyleVersion={2} onSelect={vi.fn()} />,
    );
    expect(fake.sourceIds()).toEqual([SOURCE]);
    expect(fake.layerIds()).toEqual(LAYERS);
  });

  it('shows the site count in the Camping color, names the area, and opens via onSelect', async () => {
    const onSelect = vi.fn();
    render(<CampingAreasLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [forest, park] = liveMarkers().map((m) => m.getElement());
    expect(forest!.querySelector('.map-marker-text')?.textContent).toBe('3');
    expect(forest!.style.getPropertyValue('--layer-color')).toBe('#15803d');
    expect(forest!.getAttribute('aria-label')).toBe(
      'Backcountry camping: Groton State Forest, state forest, 3 sites',
    );
    expect(park!.getAttribute('aria-label')).toBe(
      'Backcountry camping: Little River State Park, state park, 1 site',
    );

    click(park!);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a2' }));
    expect(openPopups()).toHaveLength(0);
  });

  it('renders nothing and logs when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampingAreasLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    expect(fake.layerIds()).toEqual([]);
  });

  it('puts hostile upstream strings into the marker name as text, never markup', async () => {
    fetchMock.mockResolvedValue([makeCampingArea({ name: XSS_PAYLOAD, type: XSS_PAYLOAD })]);
    render(<CampingAreasLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
