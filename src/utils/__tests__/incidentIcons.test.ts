/**
 * Tests for incident marker icons and DOM marker elements.
 */
import { describe, it, expect } from 'vitest';
import { getIncidentIcon, getIncidentIconName } from '../incidentIcons';
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
