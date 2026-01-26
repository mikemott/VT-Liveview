import { describe, it, expect } from 'vitest';
import { calculateResortColor } from '../skiConditions.js';

describe('calculateResortColor', () => {
  it('returns green for good snow and operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 2.5,
      trailsOpen: 80,
      trailsTotal: 100,
      liftsOpen: 14,
      liftsTotal: 15,
    });
    expect(result).toBe('green');
  });

  it('returns yellow for decent snow and moderate operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 0.5,
      trailsOpen: 50,
      trailsTotal: 100,
      liftsOpen: 6,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });

  it('returns yellow for open resort with no fresh snow', () => {
    const result = calculateResortColor({
      snowfall24hr: 0,
      trailsOpen: 80,
      trailsTotal: 100,
      liftsOpen: 12,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });

  it('returns red for poor operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 1,
      trailsOpen: 20,
      trailsTotal: 100,
      liftsOpen: 2,
      liftsTotal: 15,
    });
    expect(result).toBe('red');
  });

  it('handles null snowfall', () => {
    const result = calculateResortColor({
      snowfall24hr: null,
      trailsOpen: 70,
      trailsTotal: 100,
      liftsOpen: 10,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });
});
