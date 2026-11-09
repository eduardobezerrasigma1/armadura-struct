import { maskCadFixture } from './maskCad';
import { nativePrimitive } from '../../src/domain/nativeMasks';
export function maskManipFixture() {
  const p = maskCadFixture();
  p.masks[0].primitives = [
    nativePrimitive(
      {
        kind: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        closed: false,
      },
      'line',
    ),
    nativePrimitive(
      { kind: 'circle', center: { x: 0, y: 500 }, radius: 100 },
      'circle',
    ),
    nativePrimitive(
      {
        kind: 'rectangle',
        points: [
          { x: 0, y: 900 },
          { x: 1000, y: 1100 },
        ],
        closed: true,
      },
      'rectangle',
    ),
  ];
  p.masks[1].primitives = [
    nativePrimitive(
      {
        kind: 'line',
        points: [
          { x: 1500, y: 0 },
          { x: 1500, y: 1000 },
        ],
        closed: false,
      },
      'external-line',
    ),
  ];
  p.annotations = [
    {
      id: 'static-dimension',
      kind: 'dimension-aligned',
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 500, y: 200 },
      ],
      label: '100',
      textHeight: 25,
      color: '#abcdef',
    },
  ];
  p.hierarchy.objectDetails['static-dimension'] =
    p.hierarchy.objectDetails[p.masks[0].id];
  return p;
}
