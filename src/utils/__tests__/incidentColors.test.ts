/**
 * Tests for incident color mapping and severity logic
 */

import { describe, it, expect } from 'vitest';
import {
  INCIDENT_COLORS,
  getIncidentColor,
  getIncidentSeverity,
  shouldShowIncident,
} from '../incidentColors';
import type { IncidentType } from '@/types';

describe('INCIDENT_COLORS', () => {
  const incidentTypes: IncidentType[] = [
    'ACCIDENT',
    'CONSTRUCTION',
    'CLOSURE',
    'FLOODING',
    'HAZARD',
  ];

  it.each(incidentTypes)('should have valid hex color for %s type', (type) => {
    const color = INCIDENT_COLORS[type];
    expect(color.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(color.background).toMatch(/^#[0-9A-Fa-f]{6,8}$/);
    expect(color.name).toBeTruthy();
  });

  it('should have unique primary colors for each type', () => {
    const primaryColors = incidentTypes.map((type) => INCIDENT_COLORS[type].primary);
    const uniqueColors = new Set(primaryColors);
    expect(uniqueColors.size).toBe(incidentTypes.length);
  });
});

describe('getIncidentColor', () => {
  it('should return correct color for ACCIDENT', () => {
    const color = getIncidentColor('ACCIDENT');
    expect(color.primary).toBe('#8B5CF6');
    expect(color.name).toBe('purple');
  });

  it('should return correct color for CONSTRUCTION', () => {
    const color = getIncidentColor('CONSTRUCTION');
    expect(color.primary).toBe('#F97316');
    expect(color.name).toBe('orange');
  });

  it('should return correct color for CLOSURE', () => {
    const color = getIncidentColor('CLOSURE');
    expect(color.primary).toBe('#3B82F6');
    expect(color.name).toBe('blue');
  });

  it('should return correct color for FLOODING', () => {
    const color = getIncidentColor('FLOODING');
    expect(color.primary).toBe('#14B8A6');
    expect(color.name).toBe('teal');
  });

  it('should return correct color for HAZARD', () => {
    const color = getIncidentColor('HAZARD');
    expect(color.primary).toBe('#F59E0B');
    expect(color.name).toBe('amber');
  });

  it('should fallback to HAZARD color for unknown types', () => {
    // @ts-expect-error - Testing invalid type handling
    const color = getIncidentColor('UNKNOWN');
    expect(color).toEqual(INCIDENT_COLORS.HAZARD);
  });
});

describe('getIncidentSeverity', () => {
  it('should return CRITICAL for CLOSURE incidents', () => {
    expect(getIncidentSeverity({ type: 'CLOSURE' })).toBe('CRITICAL');
  });

  it('should return MAJOR for ACCIDENT incidents', () => {
    expect(getIncidentSeverity({ type: 'ACCIDENT' })).toBe('MAJOR');
  });

  it('should return MAJOR for FLOODING incidents', () => {
    expect(getIncidentSeverity({ type: 'FLOODING' })).toBe('MAJOR');
  });

  it('should return MODERATE for CONSTRUCTION incidents', () => {
    expect(getIncidentSeverity({ type: 'CONSTRUCTION' })).toBe('MODERATE');
  });

  it('should return MINOR for HAZARD incidents', () => {
    expect(getIncidentSeverity({ type: 'HAZARD' })).toBe('MINOR');
  });
});

describe('shouldShowIncident', () => {
  describe('at low zoom levels (< 8)', () => {
    const lowZoom = 7;

    it('should show CLOSURE (CRITICAL) incidents', () => {
      expect(shouldShowIncident({ type: 'CLOSURE' }, lowZoom)).toBe(true);
    });

    it('should hide ACCIDENT (MAJOR) incidents', () => {
      expect(shouldShowIncident({ type: 'ACCIDENT' }, lowZoom)).toBe(false);
    });

    it('should hide FLOODING (MAJOR) incidents', () => {
      expect(shouldShowIncident({ type: 'FLOODING' }, lowZoom)).toBe(false);
    });

    it('should hide CONSTRUCTION (MODERATE) incidents', () => {
      expect(shouldShowIncident({ type: 'CONSTRUCTION' }, lowZoom)).toBe(false);
    });

    it('should hide HAZARD (MINOR) incidents', () => {
      expect(shouldShowIncident({ type: 'HAZARD' }, lowZoom)).toBe(false);
    });
  });

  describe('at medium zoom levels (8-10)', () => {
    const mediumZoom = 9;

    it('should show CLOSURE (CRITICAL) incidents', () => {
      expect(shouldShowIncident({ type: 'CLOSURE' }, mediumZoom)).toBe(true);
    });

    it('should show ACCIDENT (MAJOR) incidents', () => {
      expect(shouldShowIncident({ type: 'ACCIDENT' }, mediumZoom)).toBe(true);
    });

    it('should show FLOODING (MAJOR) incidents', () => {
      expect(shouldShowIncident({ type: 'FLOODING' }, mediumZoom)).toBe(true);
    });

    it('should hide CONSTRUCTION (MODERATE) incidents', () => {
      expect(shouldShowIncident({ type: 'CONSTRUCTION' }, mediumZoom)).toBe(false);
    });

    it('should hide HAZARD (MINOR) incidents', () => {
      expect(shouldShowIncident({ type: 'HAZARD' }, mediumZoom)).toBe(false);
    });
  });

  describe('at high zoom levels (>= 10)', () => {
    const highZoom = 12;

    it('should show all incident types', () => {
      const types: IncidentType[] = [
        'CLOSURE',
        'ACCIDENT',
        'FLOODING',
        'CONSTRUCTION',
        'HAZARD',
      ];

      types.forEach((type) => {
        expect(shouldShowIncident({ type }, highZoom)).toBe(true);
      });
    });
  });

  describe('edge cases at zoom boundaries', () => {
    it('should hide MAJOR at exactly zoom 8', () => {
      expect(shouldShowIncident({ type: 'ACCIDENT' }, 8)).toBe(true);
    });

    it('should show all at exactly zoom 10', () => {
      expect(shouldShowIncident({ type: 'CONSTRUCTION' }, 10)).toBe(true);
    });
  });
});
