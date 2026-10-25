import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import WhatsHerePin from '../WhatsHerePin';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);

afterEach(() => resetMaplibreMock());

const point = { lat: 44.09, lng: -72.95 };

describe('WhatsHerePin (VTL-65)', () => {
  it("drops a pin with a What's here? button that opens the point", () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(
      <WhatsHerePin
        map={new FakeMap().asMap()}
        point={point}
        open={false}
        onOpen={onOpen}
        onDismiss={onDismiss}
      />,
    );
    expect(liveMarkers()).toHaveLength(1);
    expect(liveMarkers()[0]!.getLngLat()).toEqual({ lng: -72.95, lat: 44.09 });
    // MapLibre puts the marker element on the map; the fake map doesn't
    const pin = within(liveMarkers()[0]!.getElement());
    fireEvent.click(pin.getByRole('button', { name: "What's here?" }));
    expect(onOpen).toHaveBeenCalledWith(point);
    fireEvent.click(pin.getByRole('button', { name: 'Remove pin' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('keeps just the pin while the panel is open, and removes it when cleared', () => {
    const { rerender } = render(
      <WhatsHerePin
        map={new FakeMap().asMap()}
        point={point}
        open
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(liveMarkers()).toHaveLength(1);
    expect(
      within(liveMarkers()[0]!.getElement()).queryByRole('button', { name: "What's here?" }),
    ).toBeNull();
    rerender(
      <WhatsHerePin
        map={new FakeMap().asMap()}
        point={null}
        open={false}
        onOpen={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(liveMarkers()).toHaveLength(0);
  });
});
