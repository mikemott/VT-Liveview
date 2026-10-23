import { describe, it, expect } from 'vitest';
import { BEACH_COLORS } from '../beachColors';

describe('BEACH_COLORS', () => {
  it('defines a hex colour for every status colour', () => {
    expect(Object.keys(BEACH_COLORS).sort()).toEqual(['gray', 'green', 'red', 'yellow']);
    Object.values(BEACH_COLORS).forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
});
