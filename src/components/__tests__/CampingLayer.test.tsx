import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CampingLayer from '../CampingLayer';
import { fetchRecreationSites } from '../../services/recreationApi';
import { fetchBackcountrySites } from '../../services/backcountryApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeBackcountrySite, makeRecreationSite } from '../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/recreationApi', () => ({ fetchRecreationSites: vi.fn() }));
vi.mock('../../services/backcountryApi', () => ({ fetchBackcountrySites: vi.fn() }));

const recreationMock = vi.mocked(fetchRecreationSites);
const backcountryMock = vi.mocked(fetchBackcountrySites);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const campgroundEls = () =>
  liveMarkers().filter((m) => m.getElement().classList.contains('campground-marker'));
const backcountryEls = () =>
  liveMarkers().filter((m) => m.getElement().classList.contains('backcountry-marker'));

describe('CampingLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    recreationMock.mockResolvedValue([
      makeRecreationSite(),
      makeRecreationSite({ id: 'r2', name: 'Beach only', type: 'beach' }),
      makeRecreationSite({ id: 'r3', name: 'Mixed site', type: 'mixed' }),
    ]);
    backcountryMock.mockResolvedValue([
      makeBackcountrySite(),
      makeBackcountrySite({ id: 'b2', siteId: 'T-1', siteType: 'Tent site', hasFirePit: false }),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds campground and backcountry markers and reports counts', async () => {
    const onCountsChange = vi.fn();
    render(
      <CampingLayer
        map={fake.asMap()}
        visible
        showCampgrounds
        showBackcountry
        onCountsChange={onCountsChange}
      />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(4));
    expect(campgroundEls()).toHaveLength(2); // beach-only site filtered out
    expect(backcountryEls()).toHaveLength(2);
    expect(onCountsChange).toHaveBeenCalledWith(2, 2);
  });

  it('removes all markers and the open popup on unmount', async () => {
    const { unmount } = render(
      <CampingLayer map={fake.asMap()} visible showCampgrounds showBackcountry />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(4));
    click(campgroundEls()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('keeps a single popup open across marker clicks', async () => {
    render(<CampingLayer map={fake.asMap()} visible showCampgrounds showBackcountry />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(4));
    click(campgroundEls()[0]!.getElement());
    click(backcountryEls()[0]!.getElement());
    click(backcountryEls()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    expect(openPopups()[0]?.html).toContain('T-1');
  });

  it('removes markers and popup when hidden', async () => {
    const { rerender } = render(
      <CampingLayer map={fake.asMap()} visible showCampgrounds showBackcountry />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(4));
    click(backcountryEls()[0]!.getElement());

    rerender(<CampingLayer map={fake.asMap()} visible={false} showCampgrounds showBackcountry />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('only fetches and shows the enabled site types', async () => {
    const onCountsChange = vi.fn();
    render(
      <CampingLayer
        map={fake.asMap()}
        visible
        showCampgrounds={false}
        showBackcountry
        onCountsChange={onCountsChange}
      />,
    );
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(recreationMock).not.toHaveBeenCalled();
    expect(campgroundEls()).toHaveLength(0);
    expect(onCountsChange).toHaveBeenCalledWith(0, 2);
  });

  it('renders campground details and backcountry site info', async () => {
    render(<CampingLayer map={fake.asMap()} visible showCampgrounds showBackcountry />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(4));

    click(campgroundEls()[0]!.getElement());
    const camp = openPopups()[0]!.getElement();
    expect(camp.textContent).toContain('Total sites: 120');
    expect(camp.textContent).toContain('Waterbury Reservoir');
    expect(camp.textContent).toContain('Boat rental');

    click(backcountryEls()[0]!.getElement());
    const lean = openPopups()[0]!.getElement();
    expect(lean.textContent).toContain('Three-sided shelter');
    expect(lean.textContent).toContain('Fire pit available');

    click(backcountryEls()[1]!.getElement());
    const tent = openPopups()[0]!.getElement();
    expect(tent.textContent).toContain('Designated tent camping area');
    expect(tent.textContent).toContain('Primitive site');
  });

  it('logs and renders nothing when a fetch fails', async () => {
    recreationMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CampingLayer map={fake.asMap()} visible showCampgrounds showBackcountry />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
  });

  it.todo(
    'does not fetch while hidden and does not refetch when the parent re-renders (FINDINGS C3)',
  );

  it('escapes hostile upstream strings in popup HTML', async () => {
    const base = makeRecreationSite();
    recreationMock.mockResolvedValue([
      makeRecreationSite({
        name: XSS_PAYLOAD,
        address: XSS_PAYLOAD,
        town: XSS_PAYLOAD,
        phone: XSS_PAYLOAD,
        organization: XSS_PAYLOAD,
        contact: XSS_PAYLOAD,
        amenities: {
          ...base.amenities,
          swimming: { ...base.amenities.swimming!, waterBodyName: XSS_PAYLOAD },
        },
      }),
    ]);
    backcountryMock.mockResolvedValue([
      makeBackcountrySite({ siteId: XSS_PAYLOAD, siteType: XSS_PAYLOAD, notes: XSS_PAYLOAD }),
    ]);
    render(<CampingLayer map={fake.asMap()} visible showCampgrounds showBackcountry />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    click(campgroundEls()[0]!.getElement());
    const campHtml = openPopups()[0]?.html ?? '';
    expectNoInjectedMarkup(campHtml);
    expectPayloadAsText(campHtml);

    click(backcountryEls()[0]!.getElement());
    const bcHtml = openPopups()[0]?.html ?? '';
    expectNoInjectedMarkup(bcHtml);
    expectPayloadAsText(bcHtml);
    expectNoInjectedMarkup(backcountryEls()[0]!.getElement());
  });
});
