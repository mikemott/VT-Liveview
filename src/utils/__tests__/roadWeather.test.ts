import { describe, expect, it } from 'vitest';
import { cToF, describeFriction, getRoadRisk, headlineTempF } from '../roadWeather';

describe('road weather presentation', () => {
  it('converts °C to whole °F', () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(16.8)).toBe(62);
    expect(cToF(-1.5)).toBe(29);
  });

  it('prefers pavement temperature, falls back to air', () => {
    expect(headlineTempF({ pavementTempC: 0, airTempC: 5 })).toEqual({
      value: 32,
      kind: 'pavement',
    });
    expect(headlineTempF({ pavementTempC: null, airTempC: 5 })).toEqual({ value: 41, kind: 'air' });
    expect(headlineTempF({ pavementTempC: null, airTempC: null })).toBeNull();
  });

  it('ranks risk: reported ice/snow, then pavement temperature', () => {
    expect(getRoadRisk({ surface: 'Ice Warning', pavementTempC: 3 })).toBe('hazard');
    expect(getRoadRisk({ surface: 'Snow/Ice', pavementTempC: null })).toBe('hazard');
    expect(getRoadRisk({ surface: 'Wet', pavementTempC: -0.5 })).toBe('freezing');
    expect(getRoadRisk({ surface: 'Dry', pavementTempC: 1.5 })).toBe('nearFreezing'); // 35 °F
    expect(getRoadRisk({ surface: 'Dry', pavementTempC: 10 })).toBe('ok');
    expect(getRoadRisk({ surface: null, pavementTempC: null })).toBe('unknown');
  });

  it('describes friction', () => {
    expect(describeFriction(0.82)).toBe('good grip');
    expect(describeFriction(0.55)).toBe('fair grip');
    expect(describeFriction(0.31)).toBe('poor grip');
    expect(describeFriction(0.1)).toBe('very poor grip');
  });
});
