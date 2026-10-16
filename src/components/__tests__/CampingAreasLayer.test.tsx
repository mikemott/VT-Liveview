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
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';

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
    const onCountChange = vi.fn();
    const { unmount } = render(
      <CampingAreasLayer map={fake.asMap()} visible onCountChange={onCountChange} />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledWith({ minSites: 1, includeBoundaries: true });
    expect(onCountChange).toHaveBeenCalledWith(4);
    expect(fake.sourceIds()).toEqual([SOURCE]);
    expect(fake.layerIds()).toEqual(LAYERS);
    // Only areas with a boundary become polygons
    const data = fake.getSource<FakeSource>(SOURCE)?.data as { features: unknown[] };
    expect(data.features).toHaveLength(1);

    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
    expect(fake.errors).toEqual([]);
  });

  it('removes layers, markers and popup when hidden', async () => {
    const { rerender } = render(<CampingAreasLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[1]!.getElement());

    rerender(<CampingAreasLayer map={fake.asMap()} visible={false} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
  });

  it('does not fetch while hidden', () => {
    render(<CampingAreasLayer map={fake.asMap()} visible={false} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('re-adds boundary layers after a style swap (mapStyleVersion bump)', async () => {
    const { rerender } = render(
      <CampingAreasLayer map={fake.asMap()} visible mapStyleVersion={1} />,
    );
    await waitFor(() => expect(fake.layerIds()).toEqual(LAYERS));
    fake.setStyle({});
    expect(fake.layerIds()).toEqual([]);
    rerender(<CampingAreasLayer map={fake.asMap()} visible mapStyleVersion={2} />);
    expect(fake.sourceIds()).toEqual([SOURCE]);
    expect(fake.layerIds()).toEqual(LAYERS);
  });

  it('shows site count, type label and park link, and calls onAreaClick', async () => {
    const onAreaClick = vi.fn();
    render(<CampingAreasLayer map={fake.asMap()} visible onAreaClick={onAreaClick} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]!.getElement().querySelector('span')?.textContent).toBe('3');

    click(liveMarkers()[0]!.getElement());
    let el = openPopups()[0]!.getElement();
    expect(el.querySelector('.camping-areas-popup-type')?.textContent).toBe('State Forest');
    expect(el.textContent).toContain('Backcountry Sites');
    expect(el.querySelector('a')).toBeNull();

    click(liveMarkers()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    el = openPopups()[0]!.getElement();
    expect(el.textContent).toContain('Backcountry Site');
    expect(el.textContent).not.toContain('Backcountry Sites');
    expect(el.querySelector('a')?.getAttribute('href')).toBe(
      'https://vtstateparks.com/little-river',
    );
    expect(onAreaClick).toHaveBeenCalledTimes(2);
  });

  it('renders nothing and logs when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampingAreasLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Camping areas layer error:', 'down'));
    expect(liveMarkers()).toHaveLength(0);
    expect(fake.layerIds()).toEqual([]);
  });

  it('escapes hostile upstream strings in popup HTML', async () => {
    fetchMock.mockResolvedValue([
      makeCampingArea({ name: XSS_PAYLOAD, type: XSS_PAYLOAD }),
      makeCampingArea({ id: 'a3', name: XSS_PAYLOAD, type: 'state_park' }),
    ]);
    render(<CampingAreasLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    for (const marker of liveMarkers()) {
      click(marker.getElement());
      const html = openPopups()[0]?.html ?? '';
      expectNoInjectedMarkup(html);
      expectPayloadAsText(html);
      expectNoInjectedMarkup(marker.getElement());
    }
    const typeLabel = openPopups()[0]!.getElement().querySelector('.camping-areas-popup-type');
    expect(typeLabel?.textContent).toBe('State Park');
    // The park link slug strips everything but [a-z0-9-]
    const href = openPopups()[0]!.getElement().querySelector('a')?.getAttribute('href') ?? '';
    expect(href).toMatch(/^https:\/\/vtstateparks\.com\/[a-z0-9-]*$/);
  });
});
