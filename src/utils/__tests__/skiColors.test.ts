import { describe, it, expect } from 'vitest';
import { calculateResortColor, SKI_COLORS } from '../skiColors';

describe('skiColors', () => {
  describe('calculateResortColor', () => {
    it('returns green for powder day with full operations', () => {
      expect(calculateResortColor({
        snowfall24hr: 3,
        trailsOpen: 90,
        trailsTotal: 100,
        liftsOpen: 14,
        liftsTotal: 15,
      })).toBe('green');
    });

    it('returns yellow for moderate conditions', () => {
      expect(calculateResortColor({
        snowfall24hr: 1,
        trailsOpen: 50,
        trailsTotal: 100,
        liftsOpen: 8,
        liftsTotal: 15,
      })).toBe('yellow');
    });

    it('returns red for poor conditions', () => {
      expect(calculateResortColor({
        snowfall24hr: 0,
        trailsOpen: 10,
        trailsTotal: 100,
        liftsOpen: 1,
        liftsTotal: 15,
      })).toBe('red');
    });

    it('returns yellow when decent snow meets decent operations', () => {
      expect(calculateResortColor({
        snowfall24hr: 0.5,
        trailsOpen: 40,
        trailsTotal: 100,
        liftsOpen: 6,
        liftsTotal: 15,
      })).toBe('yellow');
    });

    it('returns yellow for decent operations without snow', () => {
      expect(calculateResortColor({
        snowfall24hr: null,
        trailsOpen: 50,
        trailsTotal: 100,
        liftsOpen: 8,
        liftsTotal: 15,
      })).toBe('yellow');
    });

    it('returns red when operations are below threshold', () => {
      expect(calculateResortColor({
        snowfall24hr: 2,
        trailsOpen: 30,
        trailsTotal: 100,
        liftsOpen: 5,
        liftsTotal: 15,
      })).toBe('red');
    });

    it('handles null snowfall24hr gracefully', () => {
      expect(calculateResortColor({
        snowfall24hr: null,
        trailsOpen: 80,
        trailsTotal: 100,
        liftsOpen: 12,
        liftsTotal: 15,
      })).toBe('yellow');
    });

    it('uses minimum of trails and lifts percent for operations', () => {
      // 80% trails, but only 33% lifts = 33% operations (red)
      expect(calculateResortColor({
        snowfall24hr: 0,
        trailsOpen: 80,
        trailsTotal: 100,
        liftsOpen: 5,
        liftsTotal: 15,
      })).toBe('red');
    });
  });

  describe('SKI_COLORS', () => {
    it('defines green color value', () => {
      expect(SKI_COLORS.green).toBe('#22c55e');
    });

    it('defines yellow color value', () => {
      expect(SKI_COLORS.yellow).toBe('#eab308');
    });

    it('defines red color value', () => {
      expect(SKI_COLORS.red).toBe('#ef4444');
    });

    it('has all three color keys', () => {
      expect(Object.keys(SKI_COLORS)).toEqual(['green', 'yellow', 'red']);
    });
  });
});
