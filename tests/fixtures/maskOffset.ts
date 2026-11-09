import { maskManipFixture } from './maskManipulation';
import { nativePrimitive } from '../../src/domain/nativeMasks';
import type { Point } from '../../src/domain/types';
export const offsetDumbbell: Point[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 400 },
  { x: 2000, y: 400 },
  { x: 2000, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 1000 },
  { x: 2000, y: 1000 },
  { x: 2000, y: 600 },
  { x: 1000, y: 600 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];
export function maskOffsetFixture(
  kind: 'line' | 'circle' | 'rectangle' | 'split' = 'line',
) {
  const p = maskManipFixture();
  p.masks[0].primitives = [
    nativePrimitive(
      kind === 'circle'
        ? { kind: 'circle', center: { x: 500, y: 500 }, radius: 500 }
        : kind === 'rectangle'
          ? {
              kind: 'rectangle',
              points: [
                { x: 0, y: 0 },
                { x: 1000, y: 500 },
              ],
              closed: true,
            }
          : kind === 'split'
            ? { kind: 'polyline', points: offsetDumbbell, closed: true }
            : {
                kind: 'line',
                points: [
                  { x: 0, y: 0 },
                  { x: 1000, y: 0 },
                ],
                closed: false,
              },
      'offset-source',
    ),
  ];
  return p;
}
