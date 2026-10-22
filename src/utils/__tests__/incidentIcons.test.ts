/**
 * Tests for incident marker icons and DOM marker elements.
 */
import { describe, it, expect } from 'vitest';
import { getIncidentIcon, createMarkerElement, getIncidentIconName } from '../incidentIcons';
import type { IncidentType } from '@/types';

const TYPES: IncidentType[] = ['ACCIDENT', 'CONSTRUCTION', 'CLOSURE', 'FLOODING', 'HAZARD'];

describe('getIncidentIcon', () => {
  it.each(TYPES)('returns an SVG for %s with the default size and white stroke', (type) => {
    const svg = getIncidentIcon(type);
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="20"');
    expect(svg).toContain('height="20"');
    expect(svg).toContain('stroke="#ffffff"');
  });

  it('gives each type a distinct icon', () => {
    const set = new Set(TYPES.map((t) => getIncidentIcon(t)));
    expect(set.size).toBe(TYPES.length);
  });

  it('honours size and color overrides', () => {
    const svg = getIncidentIcon('FLOODING', 32, '#123456');
    expect(svg).toContain('width="32"');
    expect(svg).toContain('stroke="#123456"');
  });

  it('falls back to the hazard icon for an unknown type', () => {
    const unknown = 'VOLCANO' as IncidentType;
    expect(getIncidentIcon(unknown, 20, '#fff')).toBe(getIncidentIcon('HAZARD', 20, '#fff'));
    // and the hazard colours when no colour is given
    expect(getIncidentIcon(unknown)).toBe(getIncidentIcon('HAZARD'));
  });
});

describe('createMarkerElement', () => {
  it('builds a marker div containing a circle with an inline SVG', () => {
    const el = createMarkerElement('ACCIDENT');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('incident-marker');
    expect(el.dataset.type).toBe('accident');

    const circle = el.querySelector<HTMLDivElement>('.marker-circle');
    expect(circle).not.toBeNull();
    expect(circle?.querySelector('svg')).not.toBeNull();
    expect(circle?.querySelector('svg')?.getAttribute('width')).toBe('16');
  });

  it('applies hover styles on mouseenter and resets on mouseleave', () => {
    const el = createMarkerElement('CONSTRUCTION');
    const circle = el.querySelector<HTMLDivElement>('.marker-circle')!;

    el.dispatchEvent(new Event('mouseenter'));
    expect(circle.style.transform).toBe('translateY(-2px) scale(1.1)');
    expect(circle.style.boxShadow).toContain('12px');

    el.dispatchEvent(new Event('mouseleave'));
    expect(circle.style.transform).toBe('translateY(0) scale(1)');
    expect(circle.style.boxShadow).toContain('8px');
  });
});

describe('getIncidentIconName', () => {
  it.each([
    ['ACCIDENT', 'alert-triangle'],
    ['CONSTRUCTION', 'hard-hat'],
    ['CLOSURE', 'ban'],
    ['FLOODING', 'waves'],
    ['HAZARD', 'alert-octagon'],
    ['UNKNOWN', 'alert-octagon'],
  ])('%s -> %s', (type, name) => {
    expect(getIncidentIconName(type as IncidentType)).toBe(name);
  });
});
