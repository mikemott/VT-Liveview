/**
 * One way to build a map marker (VTL-64).
 *
 *   <div class="map-marker ..." role="button" tabindex="0" aria-label="…">   ← MapLibre positions this
 *     <span class="map-marker-body">icon or text</span>                       ← all visuals live here
 *   </div>
 *
 * MapLibre moves a marker by setting `transform` on the outer element, so that
 * element never gets a transform or transition of its own (VTL-63); the hover
 * zoom and colors are on the inner body. Every marker is a keyboard button:
 * Tab reaches it, Enter/Space activates it, and it has a real name.
 */
import { LAYER_STYLES, type LayerStyleKey } from '../config/layers';
import './mapMarker.css';

export interface MapMarkerOptions {
  layer: LayerStyleKey;
  /** Accessible name, e.g. "Traffic camera: I-89 SB Berlin" */
  label: string;
  /** Hover tooltip (defaults to none) */
  title?: string;
  /** Trusted, hard-coded SVG markup (never feed data) */
  iconSvg?: string;
  /** Text, e.g. "42°" (set with textContent); shown under the icon if both are given */
  text?: string;
  /** circle (icons) or pill (text readings) */
  shape?: 'circle' | 'pill';
  /**
   * A status color (ski conditions, water quality, pavement risk). The body
   * takes this fill and the layer color moves to an outer ring, so the marker
   * still reads as its layer.
   */
  statusFill?: string;
  /** Faded: a reading too old to trust, or a device that's offline */
  dimmed?: boolean;
  /** Extra classes on the outer element (layer-specific styling, tests) */
  className?: string;
}

export function createMapMarker(options: MapMarkerOptions): HTMLDivElement {
  const { layer, label, title, iconSvg, text, shape = 'circle', statusFill, dimmed } = options;

  const el = document.createElement('div');
  el.className = [
    'map-marker',
    `map-marker--${shape}`,
    statusFill ? 'map-marker--status' : '',
    dimmed ? 'map-marker--dimmed' : '',
    options.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  el.dataset.layer = layer;
  el.style.setProperty('--layer-color', LAYER_STYLES[layer].color);
  if (statusFill) el.style.setProperty('--marker-fill', statusFill);

  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.setAttribute('aria-label', label);
  if (title) el.title = title;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });

  const body = document.createElement('span');
  body.className = 'map-marker-body';
  if (iconSvg) {
    // Hard-coded SVG only (see iconSvg); parsed through a template, not innerHTML on a live node
    const template = document.createElement('template');
    template.innerHTML = iconSvg.trim();
    body.append(template.content);
  }
  if (text !== undefined) {
    if (iconSvg) {
      el.classList.add('map-marker--stacked');
      const span = document.createElement('span');
      span.className = 'map-marker-text';
      span.textContent = text;
      body.append(span);
    } else {
      body.textContent = text;
    }
  }
  el.appendChild(body);
  return el;
}
