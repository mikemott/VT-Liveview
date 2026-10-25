import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CampingLayer from '../CampingLayer';
import { fetchCampgrounds } from '../../services/recreationApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeRecreationSite } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/recreationApi', () => ({ fetchCampgrounds: vi.fn() }));

const fetchMock = vi.mocked(fetchCampgrounds);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('CampingLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    fetchMock.mockResolvedValue([
      makeRecreationSite(),
      makeRecreationSite({ id: 'r3', name: 'Mixed site', type: 'mixed', town: null }),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('reports campgrounds and shows markers only while visible', async () => {
    const onLoaded = vi.fn();
    const { rerender, unmount } = render(
      <CampingLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    const loaded = onLoaded.mock.calls[0]![0] as { id: string }[];
    expect(loaded.map((site) => site.id)).toEqual(['r1', 'r3']);
    expect(liveMarkers()).toHaveLength(0);

    rerender(<CampingLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]?.lngLat).toEqual([-72.77, 44.39]);

    rerender(
      <CampingLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    expect(liveMarkers()).toHaveLength(0);

    rerender(<CampingLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    unmount();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('uses the Camping layer color and a spoken name, and opens via onSelect', async () => {
    const onSelect = vi.fn();
    render(<CampingLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const [first, mixed] = liveMarkers().map((m) => m.getElement());
    expect(first!.style.getPropertyValue('--layer-color')).toBe('#15803d');
    expect(first!.classList.contains('campground-marker')).toBe(true);
    expect(first!.getAttribute('aria-label')).toBe(
      'Campground: Little River State Park, Waterbury',
    );
    expect(mixed!.getAttribute('aria-label')).toBe('Campground: Mixed site');

    click(mixed!);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'r3' }));
    expect(openPopups()).toHaveLength(0);
  });

  it('logs and renders nothing when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampingLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('puts hostile upstream strings into the marker name as text, never markup', async () => {
    fetchMock.mockResolvedValue([makeRecreationSite({ name: XSS_PAYLOAD, town: XSS_PAYLOAD })]);
    render(<CampingLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
