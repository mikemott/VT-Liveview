import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CreemeeLayer from '../CreemeeLayer';
import { fetchCreemeeStands } from '../../services/creemeeApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeCreemeeStand, omit } from '../../__fixtures__/components/data';
import {
  XSS_PAYLOAD,
  expectNoInjectedMarkup,
  expectPayloadAsText,
} from '../../__fixtures__/components/xss';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
vi.mock('../../services/creemeeApi', () => ({ fetchCreemeeStands: vi.fn() }));

const fetchMock = vi.mocked(fetchCreemeeStands);

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('CreemeeLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    fake = new FakeMap();
    fetchMock.mockResolvedValue([
      makeCreemeeStand(),
      omit(
        makeCreemeeStand({ id: 'c2', name: 'Plain Stand', specialties: [], featured: false }),
        'description',
      ),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds markers when visible and removes markers and popup on unmount', async () => {
    const { unmount } = render(<CreemeeLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[0]!.getElement());
    expect(openPopups()).toHaveLength(1);

    unmount();
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('removes markers and popup when hidden', async () => {
    const { rerender } = render(<CreemeeLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    click(liveMarkers()[0]!.getElement());
    rerender(<CreemeeLayer map={fake.asMap()} visible={false} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(openPopups()).toHaveLength(0);
  });

  it('renders optional sections only when present and keeps one popup open', async () => {
    render(<CreemeeLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));

    click(liveMarkers()[0]!.getElement());
    const full = openPopups()[0]!.getElement();
    expect(full.querySelector('.featured-badge')).not.toBeNull();
    expect(full.querySelector('.stand-specialties li')?.textContent).toBe('Maple');
    expect(full.querySelector('.stand-location')?.textContent).toContain('Waitsfield, VT');

    click(liveMarkers()[1]!.getElement());
    expect(openPopups()).toHaveLength(1);
    const plain = openPopups()[0]!.getElement();
    expect(plain.querySelector('.featured-badge')).toBeNull();
    expect(plain.querySelector('.stand-description')).toBeNull();
    expect(plain.querySelector('.stand-specialties')).toBeNull();
  });

  it('renders no markers when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreemeeLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('escapes hostile upstream strings in popup HTML', async () => {
    fetchMock.mockResolvedValue([
      makeCreemeeStand({
        name: XSS_PAYLOAD,
        town: XSS_PAYLOAD,
        description: XSS_PAYLOAD,
        specialties: [XSS_PAYLOAD, XSS_PAYLOAD],
      }),
    ]);
    render(<CreemeeLayer map={fake.asMap()} visible />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    click(liveMarkers()[0]!.getElement());
    const html = openPopups()[0]?.html ?? '';
    expectNoInjectedMarkup(html);
    expectPayloadAsText(html);
  });
});
