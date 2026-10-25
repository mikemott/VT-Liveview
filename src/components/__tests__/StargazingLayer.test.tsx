import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StargazingLayer from '../StargazingLayer';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeDarkSkySite } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';
import type { DarkSkySite } from '../../types/stargazing';

const sites = vi.hoisted(() => ({ list: [] as DarkSkySite[] }));

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../data/darkSkySites', () => ({
  get DARK_SKY_SITES() {
    return sites.list;
  },
}));

const LAYERS = ['dark-sky-zones-fill', 'dark-sky-zones-outline'];

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('StargazingLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    sites.list = [
      makeDarkSkySite(),
      makeDarkSkySite({
        id: 'site2',
        name: 'Lake Willoughby',
        bortleClass: 3,
        coordinates: [-72.06, 44.73],
        facilities: { parking: true, camping: false, restrooms: true },
      }),
    ];
  });

  afterEach(() => {
    resetMaplibreMock();
    delete window.__xss;
  });

  it('adds zone layers and markers, and removes all on unmount', () => {
    const { unmount } = render(<StargazingLayer map={fake.asMap()} />);
    expect(fake.sourceIds()).toEqual(['dark-sky-zones']);
    expect(fake.layerIds()).toEqual(LAYERS);
    expect(fake.getPaintProperty('dark-sky-zones-fill', 'fill-opacity')).toBe(0.4);
    expect(liveMarkers()).toHaveLength(2);
    expect(liveMarkers()[0]!.getElement().querySelector('svg')?.getAttribute('fill')).toBe(
      '#ffd700',
    );
    // No popups and no map-level click listener (side panel, VTL-64)
    expect(fake.listenerCount('click')).toBe(0);

    act(() => unmount());
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
    expect(fake.listenerCount()).toBe(0);
    expect(fake.errors).toEqual([]);
  });

  it('unmounts cleanly without React root warnings', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender, unmount } = render(<StargazingLayer map={fake.asMap()} />);
    rerender(<StargazingLayer map={fake.asMap()} isDark />);
    unmount();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not add layers before the style is loaded', () => {
    fake.styleLoaded = false;
    render(<StargazingLayer map={fake.asMap()} />);
    expect(fake.layerIds()).toEqual([]);
  });

  it('opens the clicked site via onSiteClick, without a popup', () => {
    const onSiteClick = vi.fn();
    render(<StargazingLayer map={fake.asMap()} onSiteClick={onSiteClick} />);
    click(liveMarkers()[1]!.getElement());
    expect(onSiteClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'site2' }));
    expect(openPopups()).toHaveLength(0);
  });

  it('draws night-indigo markers with a spoken name and keeps them across theme changes', () => {
    const { rerender } = render(<StargazingLayer map={fake.asMap()} />);
    rerender(<StargazingLayer map={fake.asMap()} isDark />);
    expect(liveMarkers()).toHaveLength(2);
    const el = liveMarkers()[1]!.getElement();
    expect(el.style.getPropertyValue('--layer-color')).toBe('#a855f7');
    expect(el.getAttribute('role')).toBe('button');
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute('aria-label')).toBe('Dark sky site: Lake Willoughby, Bortle 3');
  });

  it('renders the conditions card, legend detail on hover and astronomy events', () => {
    const { container } = render(<StargazingLayer map={fake.asMap()} cloudCoverPercent={100} />);
    expect(screen.getByText('Tonight')).toBeInTheDocument();
    expect(container.querySelector('.moon-phase-name')?.textContent).toBeTruthy();
    expect(screen.getByText('Sky Events')).toBeInTheDocument();

    const segment = screen.getByText('2').closest('.legend-segment')!;
    fireEvent.mouseEnter(segment);
    expect(screen.getByText('What you can see:')).toBeInTheDocument();
    fireEvent.mouseLeave(segment);
    expect(screen.queryByText('What you can see:')).toBeNull();
  });

  it('renders the panel without a map', () => {
    render(<StargazingLayer map={null} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(screen.getByText('Dark Sky Quality (Bortle Scale)')).toBeInTheDocument();
  });

  it.todo('removes dark-sky layers on unmount even while isStyleLoaded() is false (FINDINGS H11)');

  it('puts hostile site strings into the marker name as text, never markup', () => {
    sites.list = [
      makeDarkSkySite({
        name: XSS_PAYLOAD,
        description: XSS_PAYLOAD,
        viewingNotes: XSS_PAYLOAD,
      }),
    ];
    render(<StargazingLayer map={fake.asMap()} />);
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
