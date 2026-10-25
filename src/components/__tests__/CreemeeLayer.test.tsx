import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CreemeeLayer from '../CreemeeLayer';
import { fetchCreemeeStands } from '../../services/creemeeApi';
import { FakeMap, liveMarkers, openPopups, resetMaplibreMock } from '../../test/maplibreMock';
import { makeCreemeeStand } from '../../__fixtures__/components/data';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';

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
      makeCreemeeStand({ id: 'c2', name: 'Plain Stand', town: 'Barre', featured: false }),
    ]);
  });

  afterEach(() => {
    resetMaplibreMock();
    vi.clearAllMocks();
    delete window.__xss;
  });

  it('adds markers while visible and removes them when hidden or unmounted', async () => {
    const onLoaded = vi.fn();
    const { rerender, unmount } = render(
      <CreemeeLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    expect(onLoaded.mock.calls[0]![0]).toHaveLength(2);
    expect(liveMarkers()).toHaveLength(0);

    rerender(<CreemeeLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    rerender(
      <CreemeeLayer map={fake.asMap()} visible={false} onSelect={vi.fn()} onLoaded={onLoaded} />,
    );
    expect(liveMarkers()).toHaveLength(0);

    rerender(<CreemeeLayer map={fake.asMap()} visible onSelect={vi.fn()} onLoaded={onLoaded} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    unmount();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('uses the Creemee layer color and a spoken name, and opens via onSelect', async () => {
    const onSelect = vi.fn();
    render(<CreemeeLayer map={fake.asMap()} visible onSelect={onSelect} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(2));
    const el = liveMarkers()[1]!.getElement();
    expect(el.style.getPropertyValue('--layer-color')).toBe('#9d174d');
    expect(el.classList.contains('map-marker--status')).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('Creemee stand: Plain Stand, Barre');

    click(el);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
    expect(openPopups()).toHaveLength(0);
  });

  it('renders no markers when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreemeeLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(liveMarkers()).toHaveLength(0);
    spy.mockRestore();
  });

  it('puts hostile upstream strings into the marker name as text, never markup', async () => {
    fetchMock.mockResolvedValue([makeCreemeeStand({ name: XSS_PAYLOAD, town: XSS_PAYLOAD })]);
    render(<CreemeeLayer map={fake.asMap()} visible onSelect={vi.fn()} />);
    await waitFor(() => expect(liveMarkers()).toHaveLength(1));
    const el = liveMarkers()[0]!.getElement();
    expectNoInjectedMarkup(el);
    expect(el.getAttribute('aria-label')).toContain(XSS_PAYLOAD);
  });
});
