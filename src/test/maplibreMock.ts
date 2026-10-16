/**
 * Shared maplibre-gl test double.
 *
 * Usage in a test file:
 *
 *   vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);
 *   import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';
 *
 *   const fake = new FakeMap();
 *   render(<SomeLayer map={fake.asMap()} visible />);
 *
 * Layer components receive `map` as a prop, so tests construct a FakeMap and pass
 * it directly; `Marker`, `Popup` and `LngLatBounds` are replaced through `vi.mock`.
 * The fake records everything a component adds so tests can assert that all of it
 * is removed again on unmount.
 */
import { vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';

// =============================================================================
// Types
// =============================================================================

export type Listener = (...args: unknown[]) => void;

export interface ListenerRecord {
  type: string;
  layerId: string | undefined;
  handler: Listener;
  once: boolean;
}

export interface LayerRecord {
  id: string;
  type: string;
  source: unknown;
  beforeId: string | undefined;
  layout: Record<string, unknown>;
  paint: Record<string, unknown>;
  spec: Record<string, unknown>;
}

export interface FakeMapOptions {
  styleLoaded?: boolean;
  zoom?: number;
  center?: { lng: number; lat: number };
  /** Layers present in the base style (used by getStyle().layers) */
  baseLayers?: Array<{ id: string; type: string }>;
}

type LngLatTuple = [number, number];

// =============================================================================
// Sources
// =============================================================================

export class FakeSource {
  readonly id: string;
  readonly spec: Record<string, unknown>;
  data: unknown;
  readonly setData = vi.fn((data: unknown) => {
    this.data = data;
    return this;
  });

  constructor(id: string, spec: Record<string, unknown>) {
    this.id = id;
    this.spec = spec;
    this.data = spec.data;
  }
}

// =============================================================================
// Map
// =============================================================================

export class FakeMap {
  readonly sources = new Map<string, FakeSource>();
  readonly layers = new Map<string, LayerRecord>();
  readonly listeners: ListenerRecord[] = [];
  readonly images = new Map<string, unknown>();
  /** Errors maplibre would emit as 'error' events instead of throwing */
  readonly errors: string[] = [];
  styleLoaded: boolean;
  zoom: number;
  center: { lng: number; lat: number };
  baseLayers: Array<{ id: string; type: string }>;
  removed = false;

  private readonly container: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;

  readonly fitBounds = vi.fn();
  readonly flyTo = vi.fn();
  readonly easeTo = vi.fn();
  readonly setStyle = vi.fn((_style?: unknown) => {
    // A style swap wipes every custom source and layer, like maplibre does.
    this.layers.clear();
    this.sources.clear();
    return this;
  });

  constructor(options: FakeMapOptions = {}) {
    this.styleLoaded = options.styleLoaded ?? true;
    this.zoom = options.zoom ?? 8;
    this.center = options.center ?? { lng: -72.5754, lat: 44.2601 };
    this.baseLayers = options.baseLayers ?? [];
    this.container = document.createElement('div');
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
  }

  /** The fake typed as a maplibre Map for passing as a component prop */
  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  // ---- sources --------------------------------------------------------------

  addSource(id: string, spec: Record<string, unknown>): this {
    if (this.sources.has(id)) {
      throw new Error(`There is already a source with ID "${id}".`);
    }
    this.sources.set(id, new FakeSource(id, spec));
    return this;
  }

  /** Like maplibre: throws for an unknown id, emits an error while a layer still uses it. */
  removeSource(id: string): this {
    if (!this.sources.has(id)) {
      throw new Error('There is no source with this ID');
    }
    const user = [...this.layers.values()].find((l) => l.source === id);
    if (user) {
      this.errors.push(`Source "${id}" cannot be removed while layer "${user.id}" is using it.`);
      return this;
    }
    this.sources.delete(id);
    return this;
  }

  getSource<T = FakeSource>(id: string): T | undefined {
    return this.sources.get(id) as T | undefined;
  }

  // ---- layers ---------------------------------------------------------------

  /** Like maplibre: duplicate ids, unknown sources and unknown beforeIds emit errors. */
  addLayer(spec: Record<string, unknown>, beforeId?: string): this {
    const id = spec.id as string;
    if (this.layers.has(id)) {
      this.errors.push(`Layer "${id}" already exists on this map.`);
      return this;
    }
    if (typeof spec.source === 'string' && !this.sources.has(spec.source)) {
      this.errors.push(`Source "${spec.source}" not found for layer "${id}".`);
      return this;
    }
    if (
      beforeId !== undefined &&
      !this.layers.has(beforeId) &&
      !this.baseLayers.some((l) => l.id === beforeId)
    ) {
      this.errors.push(`Cannot add layer "${id}" before non-existing layer "${beforeId}".`);
      return this;
    }
    this.layers.set(id, {
      id,
      type: spec.type as string,
      source: spec.source,
      beforeId,
      layout: { ...((spec.layout as Record<string, unknown> | undefined) ?? {}) },
      paint: { ...((spec.paint as Record<string, unknown> | undefined) ?? {}) },
      spec,
    });
    return this;
  }

  removeLayer(id: string): this {
    if (!this.layers.delete(id)) {
      this.errors.push(`Cannot remove non-existing layer "${id}".`);
    }
    return this;
  }

  getLayer(id: string): LayerRecord | undefined {
    return this.layers.get(id);
  }

  setLayoutProperty(id: string, name: string, value: unknown): this {
    const layer = this.layers.get(id);
    if (!layer) {
      this.errors.push(`setLayoutProperty: layer "${id}" does not exist`);
      return this;
    }
    layer.layout[name] = value;
    return this;
  }

  getLayoutProperty(id: string, name: string): unknown {
    return this.layers.get(id)?.layout[name];
  }

  setPaintProperty(id: string, name: string, value: unknown): this {
    const layer = this.layers.get(id);
    if (!layer) {
      this.errors.push(`setPaintProperty: layer "${id}" does not exist`);
      return this;
    }
    layer.paint[name] = value;
    return this;
  }

  getPaintProperty(id: string, name: string): unknown {
    return this.layers.get(id)?.paint[name];
  }

  getStyle(): { layers: Array<{ id: string; type: string }> } {
    return {
      layers: [
        ...this.baseLayers,
        ...[...this.layers.values()].map((l) => ({ id: l.id, type: l.type })),
      ],
    };
  }

  // ---- events ---------------------------------------------------------------

  on(type: string, layerOrHandler: string | Listener, maybeHandler?: Listener): this {
    this.addListener(type, layerOrHandler, maybeHandler, false);
    return this;
  }

  once(type: string, layerOrHandler: string | Listener, maybeHandler?: Listener): this {
    this.addListener(type, layerOrHandler, maybeHandler, true);
    return this;
  }

  /**
   * Mirrors maplibre 5: a listener is only removed when type, layer id and the
   * exact handler reference all match. `off(type, layerId)` without a handler
   * removes nothing.
   */
  off(type: string, layerOrHandler: string | Listener, maybeHandler?: Listener): this {
    const layerId = typeof layerOrHandler === 'string' ? layerOrHandler : undefined;
    const handler = typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler;
    if (!handler) return this;
    const index = this.listeners.findIndex(
      (l) => l.type === type && l.layerId === layerId && l.handler === handler,
    );
    if (index >= 0) this.listeners.splice(index, 1);
    return this;
  }

  /** Test helper: invoke listeners registered for `type` (and optional layer id). */
  fire(type: string, event: Record<string, unknown> = {}, layerId?: string): void {
    const matching = this.listeners.filter((l) => l.type === type && l.layerId === layerId);
    for (const record of matching) {
      if (record.once) {
        const i = this.listeners.indexOf(record);
        if (i >= 0) this.listeners.splice(i, 1);
      }
      record.handler({ type, target: this, ...event });
    }
  }

  listenerCount(type?: string, layerId?: string): number {
    return this.listeners.filter(
      (l) =>
        (type === undefined || l.type === type) && (layerId === undefined || l.layerId === layerId),
    ).length;
  }

  private addListener(
    type: string,
    layerOrHandler: string | Listener,
    maybeHandler: Listener | undefined,
    once: boolean,
  ): void {
    if (typeof layerOrHandler === 'string') {
      if (!maybeHandler) throw new Error('on(type, layerId) requires a handler');
      this.listeners.push({ type, layerId: layerOrHandler, handler: maybeHandler, once });
    } else {
      this.listeners.push({ type, layerId: undefined, handler: layerOrHandler, once });
    }
  }

  // ---- state / camera -------------------------------------------------------

  isStyleLoaded(): boolean {
    return this.styleLoaded;
  }

  loaded(): boolean {
    return this.styleLoaded;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getContainer(): HTMLDivElement {
    return this.container;
  }

  getZoom(): number {
    return this.zoom;
  }

  getCenter(): { lng: number; lat: number } {
    return { ...this.center };
  }

  // ---- images ---------------------------------------------------------------

  addImage(id: string, image: unknown): this {
    if (this.images.has(id)) {
      throw new Error(`An image named "${id}" already exists.`);
    }
    this.images.set(id, image);
    return this;
  }

  hasImage(id: string): boolean {
    return this.images.has(id);
  }

  removeImage(id: string): this {
    this.images.delete(id);
    return this;
  }

  remove(): void {
    this.removed = true;
  }

  // ---- inspection helpers ---------------------------------------------------

  sourceIds(): string[] {
    return [...this.sources.keys()];
  }

  layerIds(): string[] {
    return [...this.layers.keys()];
  }
}

// =============================================================================
// Marker
// =============================================================================

const markerRegistry = new Set<FakeMarker>();

export class FakeMarker {
  readonly options: Record<string, unknown>;
  readonly element: HTMLElement;
  lngLat: LngLatTuple | undefined;
  popup: FakePopup | undefined;
  map: FakeMap | undefined;

  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
    this.element =
      options.element instanceof HTMLElement ? options.element : document.createElement('div');
  }

  setLngLat(lngLat: LngLatTuple): this {
    this.lngLat = lngLat;
    return this;
  }

  getLngLat(): { lng: number; lat: number } | undefined {
    return this.lngLat ? { lng: this.lngLat[0], lat: this.lngLat[1] } : undefined;
  }

  setPopup(popup: FakePopup): this {
    this.popup = popup;
    return this;
  }

  addTo(map: FakeMap): this {
    this.map = map;
    markerRegistry.add(this);
    return this;
  }

  remove(): this {
    this.map = undefined;
    markerRegistry.delete(this);
    return this;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}

/** Markers currently added to a map (added and not yet removed). */
export function liveMarkers(): FakeMarker[] {
  return [...markerRegistry];
}

// =============================================================================
// Popup
// =============================================================================

const popupRegistry: FakePopup[] = [];
const openPopupSet = new Set<FakePopup>();

/** An inert document: markup parsed into it never loads images or runs handlers. */
function inertDocument(): Document {
  return document.implementation.createHTMLDocument('inert');
}

export class FakePopup {
  readonly options: Record<string, unknown>;
  html: string | undefined;
  domContent: Node | undefined;
  lngLat: LngLatTuple | undefined;
  map: FakeMap | undefined;
  private readonly handlers = new Map<string, Listener[]>();
  private element: HTMLElement | undefined;

  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
    popupRegistry.push(this);
  }

  setLngLat(lngLat: LngLatTuple): this {
    this.lngLat = lngLat;
    return this;
  }

  setHTML(html: string): this {
    this.html = html;
    this.domContent = undefined;
    this.element = undefined;
    return this;
  }

  setText(text: string): this {
    const div = inertDocument().createElement('div');
    div.textContent = text;
    return this.setHTML(div.innerHTML);
  }

  setDOMContent(node: Node): this {
    this.domContent = node;
    this.html = undefined;
    this.element = undefined;
    return this;
  }

  setMaxWidth(maxWidth: string): this {
    this.options.maxWidth = maxWidth;
    return this;
  }

  addTo(map: FakeMap): this {
    this.map = map;
    openPopupSet.add(this);
    this.emit('open');
    return this;
  }

  remove(): this {
    const wasOpen = openPopupSet.delete(this);
    this.map = undefined;
    if (wasOpen) this.emit('close');
    return this;
  }

  isOpen(): boolean {
    return openPopupSet.has(this);
  }

  on(type: string, handler: Listener): this {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return this;
  }

  off(type: string, handler: Listener): this {
    const list = this.handlers.get(type) ?? [];
    this.handlers.set(
      type,
      list.filter((h) => h !== handler),
    );
    return this;
  }

  /**
   * Content element. HTML content is parsed into an inert document so tests can
   * query it without the browser ever executing injected markup.
   */
  getElement(): HTMLElement {
    if (!this.element) {
      const el = inertDocument().createElement('div');
      el.className = 'maplibregl-popup';
      if (this.html !== undefined) el.innerHTML = this.html;
      else if (this.domContent) el.appendChild(this.domContent.cloneNode(true));
      this.element = el;
    }
    return this.element;
  }

  private emit(type: string): void {
    for (const handler of this.handlers.get(type) ?? []) handler({ type, target: this });
  }
}

/** Every popup constructed since the last reset, in creation order. */
export function allPopups(): FakePopup[] {
  return [...popupRegistry];
}

/** Popups currently added to a map. */
export function openPopups(): FakePopup[] {
  return [...openPopupSet];
}

/** HTML strings passed to `setHTML` across all popups. */
export function recordedPopupHTML(): string[] {
  return popupRegistry.flatMap((p) => (p.html !== undefined ? [p.html] : []));
}

// =============================================================================
// LngLatBounds
// =============================================================================

export class FakeLngLatBounds {
  sw: LngLatTuple;
  ne: LngLatTuple;

  constructor(sw: LngLatTuple, ne: LngLatTuple) {
    this.sw = [...sw];
    this.ne = [...ne];
  }

  extend(coord: LngLatTuple): this {
    this.sw = [Math.min(this.sw[0], coord[0]), Math.min(this.sw[1], coord[1])];
    this.ne = [Math.max(this.ne[0], coord[0]), Math.max(this.ne[1], coord[1])];
    return this;
  }

  toArray(): [LngLatTuple, LngLatTuple] {
    return [this.sw, this.ne];
  }
}

// =============================================================================
// Module shape for vi.mock
// =============================================================================

class FakeControl {
  onAdd(): HTMLElement {
    return document.createElement('div');
  }
  onRemove(): void {}
}

const maplibregl = {
  Map: FakeMap,
  Marker: FakeMarker,
  Popup: FakePopup,
  LngLatBounds: FakeLngLatBounds,
  NavigationControl: FakeControl,
  GeolocateControl: FakeControl,
  ScaleControl: FakeControl,
  AttributionControl: FakeControl,
  addProtocol: vi.fn(),
  removeProtocol: vi.fn(),
};

/** Pass to `vi.mock('maplibre-gl', ...)` (supports default and named imports). */
export const maplibreModule = { ...maplibregl, default: maplibregl };

/** Clear the marker/popup registries. Call in afterEach. */
export function resetMaplibreMock(): void {
  markerRegistry.clear();
  popupRegistry.length = 0;
  openPopupSet.clear();
}
