import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import SkiLayer from '../SkiLayer';
import { fetchSkiResorts } from '../../services/skiApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeSkiResort } from '../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/skiApi', () => ({ fetchSkiResorts: vi.fn() }));

const fetchMock = vi.mocked(fetchSkiResorts);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('SkiLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    fetchMock.mockResolvedValue([
      makeSkiResort(),
      makeSkiResort({ id: 'jay', name: 'Jay Peak', color: 'red' }),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds one marker per resort when visible and removes them all on unmount', async () => {
    const { unmount } = render(<SkiLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]?.lngLat).toEqual([-72.78, 44.53]);

    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('does not add markers while hidden and removes them when hidden', async () => {
    const { rerender } = render(<SkiLayer map={fake.asMap()} visible={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(liveMarkers()).toHaveLength(0);

    rerender(<SkiLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[1]!.getElement());

    rerender(<SkiLayer map={fake.asMap()} visible={false} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('does nothing without a map', () => {
    render(<SkiLayer map={null} visible />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('keeps only one popup open at a time', async () => {
    render(<SkiLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[0]!.getElement());
    click(liveMarkers()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    expect(openPopups()[0]?.html).toContain('Jay Peak');
  });

  it('renders conditions, and N/A for missing values', async () => {
    fetchMock.mockResolvedValue([
      makeSkiResort({ snowfall24hr: null, tempCurrent: null, baseDepth: 0 }),
    ]);
    render(<SkiLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());
    const text = openPopups()[0]?.getElement().textContent ?? '';
    expect(text).toContain('Fresh: N/A');
    expect(text).toContain('Temp: N/A');
    expect(text).toContain('Base: 0"');
    expect(text).toContain('Trails: 80/116');
  });

  it('survives a fetch failure without markers', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SkiLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('escapes hostile upstream strings in popup HTML', async () => {
    fetchMock.mockResolvedValue([
      makeSkiResort({
        name: XSS_PAYLOAD,
        logoUrl: XSS_PAYLOAD,
        lastUpdated: XSS_PAYLOAD,
        status: XSS_PAYLOAD,
        color: XSS_PAYLOAD,
      }),
    ]);
    render(<SkiLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());

    const html = openPopups()[0]?.html ?? '';
    // The logo <img> is legitimate; it must not gain a handler and its src is inert text.
    expectNoInjectedMarkup(html, { allowedImgSelector: 'img.resort-logo' });
    expectPayloadAsText(html);
    expect(liveMarkers()[0]!.getElement().querySelector('img')).toBeNull();
  });
});
