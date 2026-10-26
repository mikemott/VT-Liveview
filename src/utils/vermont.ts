/**
 * Whether a point is inside Vermont, from the same outline the map draws (VTL-69).
 */
import { VERMONT_OUTLINE } from '../data/vermontOutline';
import { pointInGeometry } from './geo';

const VERMONT = { type: 'MultiPolygon' as const, coordinates: VERMONT_OUTLINE.map((r) => [r]) };

export function isInVermont(lat: number, lng: number): boolean {
  return pointInGeometry([lng, lat], VERMONT);
}
