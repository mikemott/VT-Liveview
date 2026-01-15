/**
 * Tests for NOAA weather service helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  celsiusToFahrenheit,
  degreesToCardinal,
  clearStationsCache,
} from '../noaa.js';

describe('celsiusToFahrenheit', () => {
  it('should convert 0°C to 32°F (freezing point)', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it('should convert 100°C to 212°F (boiling point)', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it('should convert -40°C to -40°F (equal point)', () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it('should convert 20°C to 68°F (room temperature)', () => {
    expect(celsiusToFahrenheit(20)).toBe(68);
  });

  it('should convert 37°C to 99°F (body temperature, rounded)', () => {
    // 37°C = 98.6°F, which rounds to 99
    expect(celsiusToFahrenheit(37)).toBe(99);
  });

  it('should handle negative temperatures', () => {
    expect(celsiusToFahrenheit(-10)).toBe(14);
    expect(celsiusToFahrenheit(-20)).toBe(-4);
  });

  it('should round to nearest integer', () => {
    // 15°C = 59°F exactly
    expect(celsiusToFahrenheit(15)).toBe(59);
    // 15.5°C = 59.9°F, rounds to 60
    expect(celsiusToFahrenheit(15.5)).toBe(60);
  });
});

describe('degreesToCardinal', () => {
  describe('primary cardinal directions', () => {
    it('should return N for 0°', () => {
      expect(degreesToCardinal(0)).toBe('N');
    });

    it('should return E for 90°', () => {
      expect(degreesToCardinal(90)).toBe('E');
    });

    it('should return S for 180°', () => {
      expect(degreesToCardinal(180)).toBe('S');
    });

    it('should return W for 270°', () => {
      expect(degreesToCardinal(270)).toBe('W');
    });

    it('should return N for 360° (full circle)', () => {
      expect(degreesToCardinal(360)).toBe('N');
    });
  });

  describe('intercardinal directions', () => {
    it('should return NE for 45°', () => {
      expect(degreesToCardinal(45)).toBe('NE');
    });

    it('should return SE for 135°', () => {
      expect(degreesToCardinal(135)).toBe('SE');
    });

    it('should return SW for 225°', () => {
      expect(degreesToCardinal(225)).toBe('SW');
    });

    it('should return NW for 315°', () => {
      expect(degreesToCardinal(315)).toBe('NW');
    });
  });

  describe('secondary intercardinal directions', () => {
    it('should return NNE for 22.5°', () => {
      expect(degreesToCardinal(22.5)).toBe('NNE');
    });

    it('should return ENE for 67.5°', () => {
      expect(degreesToCardinal(67.5)).toBe('ENE');
    });

    it('should return ESE for 112.5°', () => {
      expect(degreesToCardinal(112.5)).toBe('ESE');
    });

    it('should return SSE for 157.5°', () => {
      expect(degreesToCardinal(157.5)).toBe('SSE');
    });

    it('should return SSW for 202.5°', () => {
      expect(degreesToCardinal(202.5)).toBe('SSW');
    });

    it('should return WSW for 247.5°', () => {
      expect(degreesToCardinal(247.5)).toBe('WSW');
    });

    it('should return WNW for 292.5°', () => {
      expect(degreesToCardinal(292.5)).toBe('WNW');
    });

    it('should return NNW for 337.5°', () => {
      expect(degreesToCardinal(337.5)).toBe('NNW');
    });
  });

  describe('boundary conditions', () => {
    it('should handle values at sector boundaries', () => {
      // Each sector is 22.5° wide, centered on the cardinal direction
      // 0° is centered at N, so 0-11.25° should round to N
      expect(degreesToCardinal(11)).toBe('N');
      expect(degreesToCardinal(12)).toBe('NNE');
    });

    it('should handle values greater than 360°', () => {
      // 450° = 90° (modulo 360) = E
      // But our function uses modulo 16 on the index, so let's test
      expect(degreesToCardinal(450)).toBe('E');
    });
  });
});

describe('clearStationsCache', () => {
  it('should return success response', () => {
    const result = clearStationsCache();

    expect(result.cleared).toBe(true);
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
  });

  it('should return valid ISO timestamp', () => {
    const result = clearStationsCache();

    // Verify the timestamp is a valid ISO string
    const date = new Date(result.timestamp);
    expect(date.toISOString()).toBe(result.timestamp);
  });

  it('should be idempotent (can be called multiple times)', () => {
    const result1 = clearStationsCache();
    const result2 = clearStationsCache();

    expect(result1.cleared).toBe(true);
    expect(result2.cleared).toBe(true);
  });
});
