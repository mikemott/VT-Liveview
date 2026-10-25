import { describe, expect, it } from 'vitest';
import { distanceMiles, nearestTown, pointInGeometry } from '../geo';

describe('distanceMiles', () => {
  it('measures Montpelier to Burlington at about 35 miles', () => {
    expect(distanceMiles(44.2601, -72.5754, 44.4759, -73.2121)).toBeCloseTo(35, 0);
  });
});

describe('nearestTown', () => {
  it('names the town a point is in, with its county', () => {
    // Lincoln Gap, on the Lincoln side
    expect(nearestTown(44.0935, -72.95)).toMatchObject({ name: 'Lincoln', county: 'Addison' });
    expect(nearestTown(44.2601, -72.5754)).toMatchObject({
      name: 'Montpelier',
      county: 'Washington',
    });
  });

  it('returns null well outside Vermont', () => {
    expect(nearestTown(42.36, -71.06)).toBeNull(); // Boston
  });
});

describe('pointInGeometry', () => {
  const square = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ],
    ],
  };
  const withHole = {
    type: 'Polygon' as const,
    coordinates: [
      square.coordinates[0]!,
      [
        [0.5, 0.5],
        [1.5, 0.5],
        [1.5, 1.5],
        [0.5, 1.5],
        [0.5, 0.5],
      ],
    ],
  };
  it('handles polygons, holes and multipolygons', () => {
    expect(pointInGeometry([1, 1], square)).toBe(true);
    expect(pointInGeometry([3, 1], square)).toBe(false);
    expect(pointInGeometry([1, 1], withHole)).toBe(false);
    expect(pointInGeometry([0.25, 0.25], withHole)).toBe(true);
    expect(
      pointInGeometry([5, 5], {
        type: 'MultiPolygon',
        coordinates: [
          square.coordinates,
          [
            [
              [4, 4],
              [6, 4],
              [6, 6],
              [4, 6],
              [4, 4],
            ],
          ],
        ],
      }),
    ).toBe(true);
    expect(pointInGeometry([1, 1], null)).toBe(false);
  });
});
