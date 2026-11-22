/**
 * Temperature conversion for the °F + °C display (VTL-98).
 */

/** Fahrenheit to whole degrees Celsius */
export function fToC(f: number): number {
  // `+ 0` turns -0 into 0 so we never print "-0°C"
  return Math.round(((f - 32) * 5) / 9) + 0;
}

/** Celsius to whole degrees Fahrenheit */
export function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32) + 0;
}

/**
 * Both units for a reading, each rounded from the source value (not from the
 * other rounded unit), so a Celsius sensor reading of 0.4 °C shows 33°F 0°C.
 * `unit` is 'F' (default) or 'C'.
 */
export function bothUnits(value: number, unit = 'F'): { f: number; c: number } {
  if (unit === 'C') return { f: cToF(value), c: Math.round(value) + 0 };
  return { f: Math.round(value) + 0, c: fToC(value) };
}
