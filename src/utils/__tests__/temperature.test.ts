import { describe, expect, it } from 'vitest';
import { bothUnits, cToF, fToC } from '../temperature';

describe('temperature conversion (VTL-98)', () => {
  it('converts Fahrenheit to whole Celsius', () => {
    expect(fToC(32)).toBe(0);
    expect(fToC(212)).toBe(100);
    expect(fToC(-40)).toBe(-40);
    expect(fToC(42)).toBe(6);
  });

  it('never prints negative zero', () => {
    expect(Object.is(fToC(31.5), 0)).toBe(true);
    expect(Object.is(cToF(-17.9), 0)).toBe(true);
  });

  it('converts Celsius to whole Fahrenheit', () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(-3.2)).toBe(26);
  });

  it('rounds each unit from the source value', () => {
    expect(bothUnits(0.4, 'C')).toEqual({ f: 33, c: 0 });
    expect(bothUnits(41.6)).toEqual({ f: 42, c: 5 });
    expect(bothUnits(41.6, 'F')).toEqual({ f: 42, c: 5 });
  });
});
