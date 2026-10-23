import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import BeachLayer from '../BeachLayer';
import { fetchBeaches } from '../../services/beachApi';
import type { Beach } from '../../services/beachApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeBeach } from '../../__fixtures__/components/data';
import { BEACH_COLORS } from '../../utils/beachColors';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/beachApi', () => ({ fetchBeaches: vi.fn() }));

const fetchMock = vi.mocked(fetchBeaches);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('BeachLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    // Fixture results are from July 1; keep them "fresh" for these tests
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'));
    fake = new FakeMap();
    fetchMock.mockResolvedValue([
      makeBeach(),
      makeBeach({
        id: 'beach2',
        name: 'Oakledge',
        status: 'closed',
        color: 'red',
        waterQualityGrade: null,
        advisory: 'Cyanobacteria bloom',
        amenities: [],
      }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds markers when visible and removes markers and popup on unmount', async () => {
    const { unmount } = render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    expect(liveMarkers()[0]?.options.anchor).toBe('center');
    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('removes markers and popup when hidden', async () => {
    const { rerender } = render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[0]!.getElement());
    rerender(<BeachLayer map={fake.asMap()} visible={false} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it.each<[Beach['status'], string]>([
    ['open', 'Open'],
    ['alert', 'Alert'],
    ['closed', 'Closed'],
    ['unknown', 'Unknown'],
  ])('labels status %s as %s', async (status, label) => {
    fetchMock.mockResolvedValue([makeBeach({ status })]);
    render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());
    const status$ = openPopups()[0]!.getElement().querySelector('.beach-status');
    expect(status$?.textContent).toContain(label);
    expect(status$?.classList.contains(status)).toBe(true);
  });

  it('shows water quality and amenities, or the advisory, as available', async () => {
    render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    click(liveMarkers()[0]!.getElement());
    let el = openPopups()[0]!.getElement();
    expect(el.querySelector('.quality-grade')?.textContent).toBe('A');
    expect(el.textContent).toContain('12 per 100mL');
    expect(el.querySelectorAll('.amenity')).toHaveLength(2);
    expect(el.querySelector('.beach-advisory')).toBeNull();

    click(liveMarkers()[1]!.getElement());
    el = openPopups()[0]!.getElement();
    expect(el.querySelector('.water-quality-section')).toBeNull();
    expect(el.querySelector('.beach-advisory')?.textContent).toBe('Cyanobacteria bloom');
    expect(el.querySelector('.beach-amenities')).toBeNull();
  });

  it('labels unmonitored beaches and stale off-season results instead of showing them as current', async () => {
    vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    fetchMock.mockResolvedValue([
      makeBeach({ lastTested: '09/21/2026 11:45 AM' }),
      makeBeach({
        id: 'beach3',
        name: 'Lake Elmore',
        status: 'unknown',
        color: 'yellow',
        lastTested: null,
        waterQualityGrade: null,
        eColiLevel: null,
      }),
    ]);
    render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    // Neither marker uses the yellow "advisory" color
    for (const marker of liveMarkers()) {
      expect(marker.getElement().style.background).toBe(BEACH_COLORS.gray);
    }

    click(liveMarkers()[0]!.getElement());
    let el = openPopups()[0]!.getElement();
    expect(el.querySelector('.beach-status')?.textContent).toContain('Season over');
    expect(el.querySelector('.beach-status-detail')?.textContent).toBe('Last tested Sep 21 (Open)');
    expect(el.querySelector('.quality-grade')).toBeNull();

    click(liveMarkers()[1]!.getElement());
    el = openPopups()[0]!.getElement();
    expect(el.querySelector('.beach-status')?.textContent).toContain('Not monitored');
  });

  it('renders no markers when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('escapes hostile upstream strings in popup HTML', async () => {
    fetchMock.mockResolvedValue([
      makeBeach({
        name: XSS_PAYLOAD,
        town: XSS_PAYLOAD,
        advisory: XSS_PAYLOAD,
        waterQualityGrade: XSS_PAYLOAD,
        amenities: [XSS_PAYLOAD],
        status: XSS_PAYLOAD as Beach['status'],
        color: XSS_PAYLOAD as Beach['color'],
        lastTested: XSS_PAYLOAD,
        lastUpdated: XSS_PAYLOAD,
      }),
    ]);
    render(<BeachLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());
    const html = openPopups()[0]?.html ?? '';
    expectNoInjectedMarkup(html);
    expectPayloadAsText(html);
  });
});
