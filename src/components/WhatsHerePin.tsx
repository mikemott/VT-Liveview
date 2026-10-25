/**
 * A dropped pin with a "What's here?" button (VTL-65).
 *
 * Long-press (touch) or right-click (desktop) on the map drops it; the button
 * opens the point in the side panel. While that panel is open the pin stays
 * to mark the spot, without the button.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import { Info, X } from 'lucide-react';
import type { MapLibreMap } from '../types';
import './WhatsHerePin.css';

interface WhatsHerePinProps {
  map: MapLibreMap | null;
  point: { lat: number; lng: number } | null;
  /** The panel for this point is open: show just the pin */
  open: boolean;
  onOpen: (point: { lat: number; lng: number }) => void;
  onDismiss: () => void;
}

export default function WhatsHerePin({ map, point, open, onOpen, onDismiss }: WhatsHerePinProps) {
  // The marker's element; React renders into it through a portal
  const [container] = useState(() => document.createElement('div'));

  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    const marker = new maplibregl.Marker({ element: container, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, container, lat, lng]);

  if (!map || !point) return null;
  return createPortal(
    <div className="whats-here">
      {!open && (
        <div className="whats-here-callout">
          <button type="button" className="whats-here-open" onClick={() => onOpen(point)}>
            <Info size={14} aria-hidden="true" />
            What's here?
          </button>
          <button
            type="button"
            className="whats-here-dismiss"
            aria-label="Remove pin"
            onClick={onDismiss}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <span className="whats-here-pin" aria-hidden="true" />
    </div>,
    container,
  );
}
