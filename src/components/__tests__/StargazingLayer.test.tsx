import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StargazingLayer from '../StargazingLayer';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeDarkSkySite } from '../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';
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

  it('adds zone layers, markers and a click listener, and removes all on unmount', () => {
    const { unmount } = render(<StargazingLayer map={fake.asMap()} />);
    expect(fake.sourceIds()).toEqual(['dark-sky-zones']);
    expect(fake.layerIds()).toEqual(LAYERS);
    expect(fake.getPaintProperty('dark-sky-zones-fill', 'fill-opacity')).toBe(0.4);
    expect(liveMarkers()).toHaveLength(2);
    expect(liveMarkers()[0]!.getElement().querySelector('svg')?.getAttribute('fill')).toBe(
      '#ffd700',
    );
    expect(fake.listenerCount('click')).toBe(1);

    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

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

  it('opens one popup at a time, closes it on map click and reports the site', () => {
    const onSiteClick = vi.fn();
    render(<StargazingLayer map={fake.asMap()} onSiteClick={onSiteClick} />);
    click(liveMarkers()[0]!.getElement());
    click(liveMarkers()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    expect(onSiteClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'site2' }));

    const content = openPopups()[0]!.domContent as HTMLElement;
    expect(content.querySelector('h3')?.textContent).toBe('Lake Willoughby');
    expect(content.querySelectorAll('.facility-tag')).toHaveLength(2);
    expect(content.querySelector('.bortle-badge')?.textContent).toMatch(/^Bortle 3/);

    fake.fire('click');
    expect(openPopups()).toHaveLength(0);
  });

  it('rebuilds markers with dark popups when the theme changes', () => {
    const { rerender } = render(<StargazingLayer map={fake.asMap()} />);
    rerender(<StargazingLayer map={fake.asMap()} isDark />);
    expect(liveMarkers()).toHaveLength(2);
    expect(fake.listenerCount('click')).toBe(1);
    click(liveMarkers()[0]!.getElement());
    const content = openPopups()[0]!.domContent as HTMLElement;
    expect(content.classList.contains('dark')).toBe(true);
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
  it.todo('star markers are keyboard focusable with an accessible name (FINDINGS H15)');

  it('renders hostile site strings as text in the popup DOM', () => {
    sites.list = [
      makeDarkSkySite({
        name: XSS_PAYLOAD,
        description: XSS_PAYLOAD,
        viewingNotes: XSS_PAYLOAD,
      }),
    ];
    render(<StargazingLayer map={fake.asMap()} />);
    click(liveMarkers()[0]!.getElement());
    const content = openPopups()[0]!.domContent as HTMLElement;
    expectNoInjectedMarkup(content);
    expectPayloadAsText(content);
    expectNoInjectedMarkup(liveMarkers()[0]!.getElement());
  });
});
