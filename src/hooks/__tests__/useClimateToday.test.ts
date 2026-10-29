import { describe, expect, it } from 'vitest';
import { msUntilVermontMidnight, vermontDate } from '../useClimateToday';

describe('Vermont day boundary (VTL-81)', () => {
  it('uses the Vermont date', () => {
    // 11:30 PM Oct 28 in Vermont is Oct 29 in UTC
    expect(vermontDate(new Date('2026-10-29T03:30:00Z'))).toBe('2026-10-28');
  });

  it('counts down to Vermont midnight', () => {
    // 11:30 PM EDT: 30 minutes to go
    expect(msUntilVermontMidnight(new Date('2026-10-29T03:30:00Z'))).toBe(30 * 60_000);
    // 12:00:30 AM EST (after the clocks go back): almost a full day
    expect(msUntilVermontMidnight(new Date('2026-11-02T05:00:30Z'))).toBe(24 * 3600_000 - 30_000);
  });
});
