import {
  hitMaskCadEntity,
  type MaskCadEntity,
  type MaskEntityRef,
} from '../domain/maskCadEditing';
import { styledDrafting } from '../domain/cadDefaults';
import type {
  FollowEdge,
  FollowChain,
  previewFollow,
} from '../domain/followForm';
import { physicalBarTextPrimitives } from '../domain/drawingPrimitives';
import {
  visibilityProjection,
  visibilityReview,
  visibilityState,
} from '../domain/visibility';
import { drawingPrimitives } from '../domain/drawingPrimitives';
import { objectState, layerState } from '../domain/layerProfiles';
import { stylePrimitive, resolveStyle, dashArray } from '../domain/layers';
import {
  representationPoint,
  representationPoints as insertedPoints,
  representationPrimitives,
  showsPhysicalDescription,
} from '../domain/representations';
import {
  quantityLabel,
  detailTitle,
  assemblyLabel,
} from '../domain/detailQuantities';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Crosshair,
  Hand,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
} from 'lucide-react';
import {
  add,
  bounds,
  distance,
  format,
  geometry,
  local,
  mul,
  nearest,
  path,
  sampled,
  sub,
  vertices,
  world,
} from '../domain/geometry';
import { maskPrimitives } from '../cad/import';
import {
  annotationPrimitives,
  primitiveBounds,
  distributionOrigins,
  distributionPrimitives,
} from '../domain/drafting';
import { projectPoints } from '../domain/model';
import {
  detailEditorView,
  groupedDetailForObject,
  toggleDetailSelection,
} from '../domain/detailEditing';
import type { Bar, Point, Primitive, Project, Tool } from '../domain/types';
export type Camera = { x: number; y: number; s: number };
export type CadState = {
  view: Camera;
  overview: { projectId: string; view: Camera } | null;
};
export type CadHandle = {
  fit: () => void;
  zoom: (factor: number) => void;
  getState: () => CadState;
};
type Props = {
  maskSidePick?: boolean;
  maskEditing?: {
    entities: MaskCadEntity[];
    targetMaskId: string;
    all?: boolean;
    stage: 'limits' | 'targets';
    selectedTarget?: string;
  };
  onMaskEntityPick?: (
    ref: MaskEntityRef | undefined,
    point: Point,
    tolerance: number,
  ) => void;
  onMaskEntityHover?: (
    ref: MaskEntityRef | undefined,
    point: Point,
    tolerance?: number,
  ) => void;
  maskCadOverlay?: {
    limits: Primitive[];
    change: Primitive[];
    mode: 'trim' | 'extend';
  };
  highlightedMaskId?: string;
  followInteraction?: {
    mode: 'edges' | 'side';
    available: FollowEdge[];
    selected: FollowEdge[];
    chain?: FollowChain;
    preview?: ReturnType<typeof previewFollow>;
    sidePoint?: Point;
  };
  onFollowEdge?: (key: string) => void;
  nativeDrawing?: boolean;
  onNativePick?: (maskId: string, entityId: string) => void;
  extraSnapPoints?: Point[];
  previewLines?: Primitive[];
  previewBase?: Point;
  onContextRequest: (ids: string[], point: Point, screen: Point) => void;
  commandActive?: boolean;
  layerContext?: string;
  project: Project;
  initialState?: CadState;
  tool: Tool;
  selected: string[];
  setSelected: (ids: string[]) => void;
  onPoint: (p: Point) => void;
  onPrimitive: (p: Primitive, polylineId?: string) => void;
  onFinish: () => void;
  onBarChange: (id: string, patch: Partial<Bar>) => void;
  draft: Point[];
  grid: boolean;
  snap: boolean;
  ortho: boolean;
  light: boolean;
  setTool: (t: Tool) => void;
  onCursor: (p: Point) => void;
  showDimensions: boolean;
  isolatedDetailId?: string;
  onEditDetail: (id: string) => void;
};
export default forwardRef<CadHandle, Props>(function CadCanvas(props, ref) {
  const {
    project: source,
    tool,
    selected,
    setSelected,
    onPoint,
    draft,
    grid,
    snap,
    ortho,
    light,
  } = props;
  const project = useMemo(
    () =>
      visibilityProjection(
        detailEditorView(source, props.isolatedDetailId),
        props.layerContext ?? 'model',
        'visible',
      ),
    [source, props.isolatedDetailId, props.layerContext],
  );
  const capturable = useMemo(
    () =>
      visibilityProjection(project, props.layerContext ?? 'model', 'capture'),
    [project, props.layerContext],
  );
  const review = useMemo(() => {
    if (!visibilityState(source, props.layerContext ?? 'model').showHidden)
      return { lines: [] as Primitive[], issue: '' };
    try {
      return {
        lines: drawingPrimitives(
          visibilityReview(
            detailEditorView(source, props.isolatedDetailId),
            props.layerContext ?? 'model',
          ),
          source,
        ).map((p) => ({
          ...p,
          resolvedStyle: p.resolvedStyle
            ? { ...p.resolvedStyle, color: '#f59e0b', fill: 'none' as const }
            : undefined,
        })),
        issue: '',
      };
    } catch (e) {
      return {
        lines: [] as Primitive[],
        issue: `Realce indisponível: ${(e as Error).message} Use a lista de objetos para recuperar ou encerrar o realce.`,
      };
    }
  }, [source, props.layerContext, props.isolatedDetailId]);
  const ghosts = review.lines;
  const lastHit = useRef<string | null>(null);
  const overview = useRef<{
    projectId: string;
    view: { x: number; y: number; s: number };
  } | null>(props.initialState?.overview ?? null);
  const groupedIds = useMemo(
    () =>
      new Set(
        source.hierarchy.details.filter((d) => d.grouped).map((d) => d.id),
      ),
    [source.hierarchy.details],
  );
  const individual = (id: string) =>
    !!props.isolatedDetailId ||
    !groupedIds.has(source.hierarchy.objectDetails[id]);
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [view, setView] = useState(
    props.initialState?.view ?? { x: 2800, y: -300, s: 0.12 },
  );
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapPoint, setSnapPoint] = useState<Point | null>(null);
  const [drag, setDrag] = useState<{ screen: Point; view: typeof view } | null>(
    null,
  );
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(
    null,
  );
  const [grip, setGrip] = useState<{
    id: string;
    index: number;
    point: Point;
  } | null>(null);
  const space = useRef(false);
  useEffect(() => {
    if (!host.current) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(host.current);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = () => {
      space.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const masks = useMemo(
    () =>
      project.masks.map((m) => {
        const items = maskPrimitives(m).map((item) =>
          stylePrimitive(source, m, item),
        );
        const paths = new Map<string, { d: string[]; item: Primitive }>();
        for (const p of items) {
          if (p.text || !p.points.length) continue;
          const key = JSON.stringify([p.layer, p.resolvedStyle, p.closed]);
          if (!paths.has(key)) paths.set(key, { d: [], item: p });
          paths
            .get(key)!
            .d.push(
              p.points
                .map((v, i) => `${i ? 'L' : 'M'}${v.x},${v.y}`)
                .join(' ') + (p.closed ? ' Z' : ''),
            );
        }
        return {
          mask: m,
          items,
          capture: objectState(source, props.layerContext ?? 'model', m)
            .capture,
          texts: items.filter((p) => p.text),
          paths: [...paths].map(([key, group]) => ({
            key,
            item: group.item,
            d: group.d.join(' '),
          })),
        };
      }),
    [project.masks, source, props.layerContext],
  );
  const annotations = useMemo(
    () =>
      project.annotations.map((a) => ({
        annotation: a,
        items: annotationPrimitives(a, source).map((item) =>
          stylePrimitive(source, a, item),
        ),
      })),
    [project],
  );
  const barGeometries = useMemo(
    () => new Map(source.bars.map((b) => [b.id, geometry(b)])),
    [source.bars],
  );
  const barDefinitions = useMemo(
    () => new Map(source.bars.map((b) => [b.id, b])),
    [source.bars],
  );
  // Camera/cursor updates must not rebuild physical geometry, captions or insertions.
  // These caches are local to this canvas and invalidated by immutable project edits.
  const barPresentations = useMemo(
    () =>
      new Map(
        project.bars.map((b) => [
          b.id,
          {
            path: path(barGeometries.get(b.id)!.segments),
            texts: physicalBarTextPrimitives(
              { ...b, origin: { x: 0, y: 0 }, rotation: 0 },
              source,
            ).map((item) =>
              b.drafting ? styledDrafting(source, b, item) : item,
            ),
            style: resolveStyle(source, b, 'ARMADURAS'),
            origins:
              b.distribution?.render === 'bars'
                ? distributionOrigins(b)
                : [b.origin],
          },
        ]),
      ),
    [project.bars, barGeometries, source],
  );
  const representations = useMemo(
    () =>
      project.details.flatMap((d) => {
        const b = barDefinitions.get(d.barId);
        return b
          ? [
              {
                detail: d,
                bar: b,
                items: representationPrimitives(b, d, source).map((item) =>
                  styledDrafting(source, d, item, 'REBATIMENTOS'),
                ),
              },
            ]
          : [];
      }),
    [project.details, barDefinitions, source],
  );
  const polylineItems = useMemo(
    () =>
      project.polylines.map((l) => ({
        line: l,
        item: stylePrimitive(source, l, { ...l, layer: 'DESENHO' }),
      })),
    [project.polylines, source.layers],
  );
  const distributions = useMemo(
    () =>
      project.bars
        .filter((b) => b.distribution)
        .map((b) => ({
          bar: b,
          items: distributionPrimitives(b, undefined, source).map((item) =>
            styledDrafting(source, b, item, 'ARMADURAS'),
          ),
        })),
    [project.bars, source],
  );
  const representationPoints = useMemo(
    () =>
      project.details.flatMap((d) => {
        const bar = barDefinitions.get(d.barId);
        return bar
          ? [
              ...insertedPoints(bar, d),
              ...(d.label
                ? representationPrimitives(bar, d, source)
                    .filter((p) => p.text)
                    .flatMap(primitiveBounds)
                : []),
            ]
          : [];
      }),
    [project.details, barDefinitions, barGeometries],
  );
  const allPoints = useMemo(
    () => [
      ...projectPoints(project),
      ...ghosts.flatMap(primitiveBounds),
      ...(props.previewLines ?? []).flatMap(primitiveBounds),
      ...representationPoints,
      ...annotations.flatMap((a) => a.items.flatMap(primitiveBounds)),
      ...masks.flatMap((m) => m.items.flatMap(primitiveBounds)),
    ],
    [
      project,
      masks,
      annotations,
      representationPoints,
      ghosts,
      props.previewLines,
    ],
  );
  const groupBoxes = useMemo(() => {
    if (props.isolatedDetailId) return [];
    const grouped = new Map(
      source.hierarchy.details.filter((d) => d.grouped).map((d) => [d.id, d]),
    );
    const boxes = new Map<
      string,
      { x: number; y: number; right: number; top: number }
    >();
    const addPoints = (id: string, points: Point[]) => {
      const owner = source.hierarchy.objectDetails[id];
      if (!grouped.has(owner)) return;
      for (const point of points) {
        const old = boxes.get(owner);
        if (old) {
          old.x = Math.min(old.x, point.x);
          old.y = Math.min(old.y, point.y);
          old.right = Math.max(old.right, point.x);
          old.top = Math.max(old.top, point.y);
        } else
          boxes.set(owner, {
            x: point.x,
            y: point.y,
            right: point.x,
            top: point.y,
          });
      }
    };
    for (const bar of project.bars) {
      const pts = sampled(barGeometries.get(bar.id)!.segments);
      const origins = bar.distribution
        ? distributionOrigins(bar)
        : [bar.origin];
      for (const origin of origins)
        addPoints(
          bar.id,
          pts.map((v) => world(v, { ...bar, origin })),
        );
    }
    for (const d of project.details) {
      const bar = barDefinitions.get(d.barId);
      if (bar) addPoints(d.id, insertedPoints(bar, d));
    }
    for (const line of project.polylines) addPoints(line.id, line.points);
    for (const a of annotations)
      for (const item of a.items)
        addPoints(a.annotation.id, primitiveBounds(item));
    for (const m of masks)
      for (const item of m.items) addPoints(m.mask.id, primitiveBounds(item));
    return [...boxes].map(([id, box]) => ({
      id,
      name: detailTitle(source, id),
      ...box,
      width: box.right - box.x,
      height: box.top - box.y,
    }));
  }, [
    project,
    source.hierarchy,
    barGeometries,
    barDefinitions,
    annotations,
    masks,
    props.isolatedDetailId,
  ]);
  const fit = () => {
    const b = bounds(allPoints);
    const s = Math.max(
      0.00001,
      Math.min(
        2,
        Math.max(80, size.w - 180) / Math.max(b.width, 500),
        Math.max(80, size.h - 120) / Math.max(b.height, 500),
      ),
    );
    setView({
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
      s,
    });
  };
  useImperativeHandle(ref, () => ({
    fit,
    getState: () => ({ view, overview: overview.current }),
    zoom: (f) =>
      setView((v) => ({ ...v, s: Math.max(0.000001, Math.min(20, v.s * f)) })),
  }));
  const initialMaskCount = useRef(project.masks.length);
  const firstScopeEffect = useRef(true);
  useEffect(() => {
    if (
      size.w > 0 &&
      (!props.initialState || project.masks.length !== initialMaskCount.current)
    )
      fit();
  }, [project.masks.length, size.w === 900]); // fit after a new reference, not after every edit
  useEffect(() => {
    setGrip(null);
    setDrag(null);
    setMarquee(null);
    if (firstScopeEffect.current && props.initialState) {
      firstScopeEffect.current = false;
      return;
    }
    firstScopeEffect.current = false;
    if (props.isolatedDetailId) {
      if (!overview.current) overview.current = { projectId: project.id, view };
      fit();
    } else if (overview.current) {
      if (overview.current.projectId === project.id)
        setView(overview.current.view);
      overview.current = null;
    }
  }, [props.isolatedDetailId, project.id]);
  const scr = (p: Point) => ({
    x: (p.x - view.x) * view.s + size.w / 2,
    y: (view.y - p.y) * view.s + size.h / 2,
  });
  const fromScreen = (p: Point) => ({
    x: (p.x - size.w / 2) / view.s + view.x,
    y: view.y - (p.y - size.h / 2) / view.s,
  });
  const eventScreen = (e: { clientX: number; clientY: number }) => {
    const rect = host.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const linework = useMemo(
    () => [
      ...masks.flatMap((m) =>
        m.items.filter(
          (p) =>
            !p.text &&
            m.capture &&
            (!p.layerId ||
              layerState(source, props.layerContext ?? 'model', p.layerId)
                .capture),
        ),
      ),
      ...capturable.polylines.map((p) => ({
        ...p,
        points: p.closed ? [...p.points, p.points[0]] : p.points,
      })),
      ...annotations
        .filter(
          (a) =>
            objectState(source, props.layerContext ?? 'model', a.annotation)
              .capture,
        )
        .flatMap((a) => a.items.filter((p) => !p.text)),
      ...capturable.bars.map((b) => ({
        points: sampled(geometry(b).segments).map((v) => world(v, b)),
      })),
    ],
    [masks, capturable, annotations],
  );
  const snapAt = (raw: Point) => {
    let target: Point | undefined,
      best = 10 / view.s;
    if (snap) {
      for (const p of props.extraSnapPoints ?? []) {
        const d = distance(p, raw);
        if (d < best) {
          best = d;
          target = p;
        }
      }
      for (const chain of linework) {
        for (let i = 0; i < chain.points.length; i++) {
          const a = chain.points[i];
          const d = distance(a, raw);
          if (d < best) {
            best = d;
            target = a;
          }
          if (i > 0) {
            const prev = chain.points[i - 1],
              mid = mul(add(prev, a), 0.5),
              dm = distance(mid, raw);
            if (dm < best) {
              best = dm;
              target = mid;
            }
          }
        }
      }
    }
    let p = target ?? raw;
    if (ortho && draft.length) {
      const a = draft.at(-1)!;
      p =
        Math.abs(p.x - a.x) >= Math.abs(p.y - a.y)
          ? { x: p.x, y: a.y }
          : { x: a.x, y: p.y };
      if (target && distance(p, target) > 0.001) target = undefined;
    }
    setSnapPoint(target ?? null);
    return p;
  };
  const hitAt = (p: Point) => {
    let hit: string | undefined,
      best = 9 / view.s;
    for (const b of capturable.bars) {
      const origins =
        b.distribution?.render === 'bars' ? distributionOrigins(b) : [b.origin];
      for (const origin of origins) {
        const ps = sampled(barGeometries.get(b.id)!.segments).map((v) =>
          world(v, { ...b, origin }),
        );
        for (let i = 1; i < ps.length; i++) {
          const d = distance(p, nearest(p, ps[i - 1], ps[i]));
          if (d < best) {
            best = d;
            hit = b.id;
          }
        }
      }
    }
    for (const object of [
      ...capturable.polylines.map((l) => ({
        id: l.id,
        items: [
          {
            ...l,
            layer: 'DESENHO',
            points: l.closed ? [...l.points, l.points[0]] : l.points,
          },
        ],
      })),
      ...annotations
        .filter(
          (a) =>
            objectState(source, props.layerContext ?? 'model', a.annotation)
              .capture,
        )
        .map((a) => ({ id: a.annotation.id, items: a.items })),
    ]) {
      for (const item of object.items) {
        if ('text' in item && item.text) {
          if (distance(p, item.points[0]) < 14 / view.s) {
            hit = object.id;
            best = 0;
          }
          continue;
        }
        for (let i = 1; i < item.points.length; i++) {
          const d = distance(p, nearest(p, item.points[i - 1], item.points[i]));
          if (d < best) {
            best = d;
            hit = object.id;
          }
        }
      }
    }
    if (!hit) {
      for (const d of capturable.details) {
        const b = barDefinitions.get(d.barId);
        if (!b) continue;
        const pts = insertedPoints(b, d);
        for (let i = 1; i < pts.length; i++)
          if (distance(p, nearest(p, pts[i - 1], pts[i])) < best) {
            hit = d.id;
            break;
          }
      }
    }
    if (!hit) {
      const box = groupBoxes.find(
        (b) =>
          p.x >= b.x - 12 / view.s &&
          p.x <= b.right + 12 / view.s &&
          p.y >= b.y - 12 / view.s &&
          p.y <= b.top + 24 / view.s,
      );
      if (box)
        hit = Object.keys(source.hierarchy.objectDetails).find(
          (id) => source.hierarchy.objectDetails[id] === box.id,
        );
    }
    if (!hit)
      for (const m of masks) {
        if (!m.capture) continue;
        for (const item of m.items) {
          if (
            item.layerId &&
            !layerState(source, props.layerContext ?? 'model', item.layerId)
              .capture
          )
            continue;
          for (let i = 1; i < item.points.length; i++)
            if (
              distance(p, nearest(p, item.points[i - 1], item.points[i])) < best
            ) {
              hit = m.mask.id;
              best = distance(
                p,
                nearest(p, item.points[i - 1], item.points[i]),
              );
            }
          if (item.text && distance(p, item.points[0]) < best) {
            hit = m.mask.id;
            best = 0;
          }
        }
      }
    return hit;
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const screen = eventScreen(e),
      p = snapAt(fromScreen(screen));
    svg.current?.setPointerCapture(e.pointerId);
    if (e.button === 1 || tool === 'pan' || space.current) {
      setDrag({ screen, view });
      return;
    }
    if (props.maskSidePick) {
      props.onMaskEntityPick?.(undefined, fromScreen(screen), 3 / view.s);
      return;
    }
    if (props.maskEditing) {
      const at = fromScreen(screen),
        state = props.maskEditing;
      const hit = hitMaskCadEntity(
        state.entities,
        at,
        10 / view.s,
        (e) =>
          state.stage === 'limits' ||
          (e.mask.id === state.targetMaskId &&
            (!state.selectedTarget || state.selectedTarget === e.ref.key)),
      );
      props.onMaskEntityPick?.(hit?.ref, at, 3 / view.s);
      return;
    }
    if (tool === 'select') {
      for (const b of capturable.bars.filter(
        (b) =>
          objectState(source, props.layerContext ?? 'model', b).editable &&
          selected.includes(b.id) &&
          b.kind === 'free' &&
          individual(b.id),
      ))
        for (let i = 0; i < b.points.length; i++)
          if (distance(world(b.points[i], b), p) < 9 / view.s) {
            setGrip({ id: b.id, index: i, point: p });
            return;
          }
      for (const m of masks.filter(
        (m) =>
          m.capture &&
          objectState(source, props.layerContext ?? 'model', m.mask).editable,
      )) {
        for (const item of m.items) {
          if (
            item.layerId &&
            (!layerState(source, props.layerContext ?? 'model', item.layerId)
              .capture ||
              !layerState(source, props.layerContext ?? 'model', item.layerId)
                .editable)
          )
            continue;
          const points = item.closed
            ? [...item.points, item.points[0]]
            : item.points;
          if (
            item.id &&
            item.native &&
            points.some(
              (v, i) =>
                i && distance(p, nearest(p, points[i - 1], v)) < 9 / view.s,
            )
          ) {
            props.onNativePick?.(m.mask.id, item.id);
            return;
          }
        }
      }
      const hit = hitAt(p);
      lastHit.current = hit || null;
      if (hit) {
        setSelected(
          toggleDetailSelection(
            source,
            selected,
            hit,
            e.shiftKey,
            props.isolatedDetailId,
          ),
        );
      } else {
        if (!e.shiftKey) setSelected([]);
        setMarquee({ start: p, end: p });
      }
    } else if (tool === 'follow') {
      if (props.followInteraction?.mode === 'side') {
        // Side picking uses the actual model point, never a snap projected onto the face.
        onPoint(fromScreen(screen));
        return;
      }
      let best = 12 / view.s,
        hit: FollowEdge | undefined;
      for (const edge of props.followInteraction?.available ?? []) {
        const d = distance(
          fromScreen(screen),
          nearest(fromScreen(screen), edge.a, edge.b),
        );
        if (d < best) {
          best = d;
          hit = edge;
        }
      }
      if (hit) props.onFollowEdge?.(hit.key);
    } else if (tool === 'convert') {
      let best = 16 / view.s,
        hit: Primitive | undefined,
        polylineId: string | undefined;
      for (const m of masks)
        for (const item of m.items) {
          if (
            !m.capture ||
            (item.layerId &&
              !layerState(source, props.layerContext ?? 'model', item.layerId)
                .capture)
          )
            continue;
          if (item.text) continue;
          const pts = item.closed
            ? [...item.points, item.points[0]]
            : item.points;
          for (let i = 1; i < pts.length; i++) {
            const d = distance(p, nearest(p, pts[i - 1], pts[i]));
            if (d < best) {
              best = d;
              hit = item;
            }
          }
        }
      if (tool === 'convert')
        for (const item of capturable.polylines.filter((l) =>
          individual(l.id),
        )) {
          const pts = item.closed
            ? [...item.points, item.points[0]]
            : item.points;
          for (let i = 1; i < pts.length; i++) {
            const d = distance(p, nearest(p, pts[i - 1], pts[i]));
            if (d < best) {
              best = d;
              hit = { ...item, layer: 'DESENHO' };
              polylineId = item.id;
            }
          }
        }
      if (hit) props.onPrimitive(hit, polylineId);
    } else onPoint(p);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const screen = eventScreen(e);
    if (drag) {
      setView({
        ...drag.view,
        x: drag.view.x - (screen.x - drag.screen.x) / view.s,
        y: drag.view.y + (screen.y - drag.screen.y) / view.s,
      });
      return;
    }
    const p = props.maskSidePick
      ? fromScreen(screen)
      : snapAt(fromScreen(screen));
    setCursor(p);
    props.onCursor(p);
    if (props.maskSidePick) props.onMaskEntityHover?.(undefined, p, 3 / view.s);
    if (props.maskEditing?.stage === 'targets') {
      const at = fromScreen(screen),
        state = props.maskEditing;
      const hit = hitMaskCadEntity(
        state.entities,
        at,
        10 / view.s,
        (e) =>
          e.mask.id === state.targetMaskId &&
          (!state.selectedTarget || state.selectedTarget === e.ref.key),
      );
      props.onMaskEntityHover?.(hit?.ref, at);
    }
    if (marquee) setMarquee({ ...marquee, end: p });
    if (grip) setGrip({ ...grip, point: p });
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
    if (grip) {
      const b = capturable.bars.find((b) => b.id === grip.id)!;
      props.onBarChange(b.id, {
        points: b.points.map((p, i) =>
          i === grip.index ? local(grip.point, b) : p,
        ),
      });
      setGrip(null);
    }
    if (marquee) {
      const box = bounds([marquee.start, marquee.end]);
      if (box.width + box.height > 5 / view.s) {
        const inside = (p: Point) =>
          p.x >= box.x &&
          p.x <= box.x + box.width &&
          p.y >= box.y &&
          p.y <= box.y + box.height;
        const ids = [
          ...capturable.details
            .filter((d) => {
              const b = barDefinitions.get(d.barId);
              return b && insertedPoints(b, d).every(inside);
            })
            .map((d) => d.id),
          ...capturable.bars
            .filter((b) =>
              vertices(b)
                .map((p) => world(p, b))
                .every(inside),
            )
            .map((b) => b.id),
          ...capturable.polylines
            .filter((l) => l.points.every(inside))
            .map((l) => l.id),
          ...capturable.annotations
            .filter((a) => a.points.every(inside))
            .map((a) => a.id),
        ];
        setSelected(e.shiftKey ? [...new Set([...selected, ...ids])] : ids);
      }
      setMarquee(null);
    }
    setDrag(null);
  };
  const stroke = 1 / view.s;
  const groupLabelSize = 11 / view.s; // Navigation overlay only; excluded from output.
  const renderBar = (
    b: Bar,
    origin = b.origin,
    isDetail = false,
    showLabel = true,
  ) => {
    const edited =
      grip?.id === b.id
        ? {
            ...b,
            points: b.points.map((p, i) =>
              i === grip.index ? local(grip.point, b) : p,
            ),
          }
        : b;
    const g = grip?.id === b.id ? geometry(edited) : barGeometries.get(b.id)!,
      active = selected.includes(b.id);
    const style = isDetail
      ? resolveStyle(source, {}, 'REBATIMENTOS')
      : barPresentations.get(b.id)!.style;
    const barPath =
      grip?.id === b.id ? path(g.segments) : barPresentations.get(b.id)!.path;
    const color = g.errors.length ? '#e76472' : style.color;
    const tr = `translate(${origin.x} ${origin.y}) rotate(${isDetail ? 0 : b.rotation})`;
    return (
      <g
        key={`${b.id}-${isDetail ? 'detail' : 'bar'}-${origin.x}-${origin.y}`}
        transform={tr}
        data-bar-id={isDetail ? undefined : b.id}
        data-layer-id={b.layerId ?? 'layer:ARMADURAS'}
      >
        {active && (
          <path
            d={barPath}
            fill="none"
            stroke={color}
            strokeWidth={8 * stroke}
            opacity="0.15"
          />
        )}
        <path
          d={barPath}
          fill="none"
          stroke={color}
          strokeWidth={
            Math.max(active ? 2.7 : 1, (style.lineWidth * 96) / 25.4) * stroke
          }
          strokeDasharray={dashArray(style).join(' ') || undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {renderPrimitives(
          (grip?.id === b.id
            ? physicalBarTextPrimitives(
                { ...edited, origin: { x: 0, y: 0 }, rotation: 0 },
                source,
              )
            : barPresentations.get(b.id)!.texts
          )
            .map((item) =>
              b.drafting ? styledDrafting(source, b, item) : item,
            )
            .filter((item) =>
              (item.role ?? item.layer) === 'IDENTIFICACAO'
                ? showLabel
                : props.showDimensions,
            ),
          color,
        )}
        {active &&
          !isDetail &&
          objectState(source, props.layerContext ?? 'model', b).editable &&
          individual(b.id) &&
          b.kind === 'free' &&
          g.vertices.map((p, i) => (
            <rect
              key={i}
              x={p.x - 3.5 * stroke}
              y={p.y - 3.5 * stroke}
              width={7 * stroke}
              height={7 * stroke}
              fill={light ? '#fff' : '#122039'}
              stroke={color}
              strokeWidth={stroke}
            />
          ))}
      </g>
    );
  };
  const renderPrimitives = (
    items: Primitive[],
    color: string,
    active = false,
  ) =>
    items.map((item, i) =>
      item.text ? (
        <g
          key={i}
          transform={`translate(${item.points[0].x} ${item.points[0].y}) rotate(${item.textRotation ?? 0}) scale(1 -1)`}
        >
          <text
            fill={item.resolvedStyle?.color ?? color}
            textRendering="geometricPrecision"
            fontSize={item.textHeight ?? 40}
            textAnchor={
              item.textAlign === 'right'
                ? 'end'
                : item.textAlign === 'center' ||
                    (!item.textAlign &&
                      ((item.role ?? item.layer) === 'COTAS' ||
                        (item.role ?? item.layer) === 'DISTRIBUICAO'))
                  ? 'middle'
                  : 'start'
            }
          >
            {item.text.replace(/%%c/g, 'Ø')}
          </text>
        </g>
      ) : (
        <path
          key={i}
          d={
            item.points
              .map((v, j) => `${j ? 'L' : 'M'}${v.x},${v.y}`)
              .join(' ') + (item.closed ? ' Z' : '')
          }
          fill={
            item.closed && item.resolvedStyle?.fill === 'solid'
              ? item.resolvedStyle.fillColor
              : 'none'
          }
          stroke={item.resolvedStyle?.color ?? color}
          strokeWidth={
            Math.max(
              active ? 2.4 : 1,
              ((item.resolvedStyle?.lineWidth ?? 0.18) * 96) / 25.4,
            ) * stroke
          }
          strokeDasharray={dashArray(item.resolvedStyle).join(' ') || undefined}
          data-layer-id={item.layerId}
          strokeLinecap="round"
        />
      ),
    );
  // Reuse the SVG element tree during cursor motion and pan. Zoom only changes
  // screen-sized strokes/handles; model geometry and text heights stay untouched.
  // Dependencies enumerate values captured by the render helpers above; using the
  // helpers themselves would invalidate these trees on every pointer event.
  const maskContent = useMemo(
    () => (
      <>
        {masks.map(({ mask, texts, paths, capture }) => (
          <g
            key={mask.id}
            data-mask-id={mask.id}
            opacity={mask.opacity}
            fill="none"
            stroke={light ? '#7e899b' : '#8090aa'}
            strokeWidth={stroke}
          >
            {paths.map(({ key, item, d }) => (
              <path
                key={key}
                d={d}
                data-layer-id={item.layerId}
                strokeLinecap="round"
                stroke={
                  mask.id === props.highlightedMaskId
                    ? '#38bdf8'
                    : props.maskEditing?.all &&
                        capture &&
                        (!item.layerId ||
                          layerState(
                            source,
                            props.layerContext ?? 'model',
                            item.layerId,
                          ).capture)
                      ? '#c084fc'
                      : item.resolvedStyle?.color
                }
                strokeWidth={
                  Math.max(
                    mask.id === props.highlightedMaskId ? 2.5 : 1,
                    ((item.resolvedStyle?.lineWidth ?? 0.18) * 96) / 25.4,
                  ) * stroke
                }
                strokeDasharray={
                  dashArray(item.resolvedStyle).join(' ') || undefined
                }
                fill={
                  item.closed && item.resolvedStyle?.fill === 'solid'
                    ? item.resolvedStyle.fillColor
                    : 'none'
                }
              />
            ))}
            {texts.map((p, i) => (
              <g
                key={i}
                transform={`translate(${p.points[0].x} ${p.points[0].y}) rotate(${p.textRotation ?? 0}) scale(1 -1)`}
              >
                <text
                  fill={
                    mask.id === props.highlightedMaskId
                      ? '#38bdf8'
                      : (p.resolvedStyle?.color ??
                        (light ? '#7e899b' : '#8090aa'))
                  }
                  stroke="none"
                  textRendering="geometricPrecision"
                  fontSize={p.textHeight}
                  textAnchor={
                    p.textAlign === 'center'
                      ? 'middle'
                      : p.textAlign === 'right'
                        ? 'end'
                        : 'start'
                  }
                >
                  {p.text}
                </text>
              </g>
            ))}
          </g>
        ))}
      </>
    ),
    [
      masks,
      light,
      stroke,
      props.highlightedMaskId,
      props.maskEditing?.all,
      props.layerContext,
      source,
    ],
  );
  const objectContent = useMemo(
    () => (
      <>
        {polylineItems.map(({ line: l, item }) => (
          <g key={l.id} data-testid="cad-polyline">
            {renderPrimitives(
              [item],
              selected.includes(l.id) ? '#58bce8' : l.color,
              selected.includes(l.id),
            )}
          </g>
        ))}
        {project.bars.flatMap((b) =>
          barPresentations
            .get(b.id)!
            .origins.map((origin, i) => renderBar(b, origin, false, i === 0)),
        )}
        {annotations.map(({ annotation: a, items }) => (
          <g key={a.id} data-testid="cad-annotation" data-kind={a.kind}>
            {renderPrimitives(
              items,
              selected.includes(a.id) ? '#58bce8' : light ? '#394861' : a.color,
              selected.includes(a.id),
            )}
          </g>
        ))}
        {representations.map(({ detail: d, bar: b, items }) => {
          return (
            <g key={d.id} data-representation-id={d.id}>
              {renderPrimitives(
                items.filter(
                  (item) =>
                    props.showDimensions ||
                    (item.role ?? item.layer) !== 'COTAS',
                ),
                b.color,
                selected.includes(d.id),
              )}
            </g>
          );
        })}
        {groupBoxes.map((box) => (
          <g
            key={box.id}
            data-testid="cad-detail-group"
            data-detail-id={box.id}
            pointerEvents="none"
          >
            <rect
              x={box.x - 12 * stroke}
              y={box.y - 12 * stroke}
              width={box.width + 24 * stroke}
              height={box.height + 24 * stroke}
              fill="none"
              stroke={light ? '#536fbb' : '#87a5ec'}
              opacity={
                selected.some(
                  (id) => source.hierarchy.objectDetails[id] === box.id,
                )
                  ? 1
                  : 0.4
              }
              strokeWidth={stroke}
              strokeDasharray={`${5 * stroke} ${4 * stroke}`}
            />
            <text
              transform={`translate(${box.x} ${box.top + 18 * stroke}) scale(1 -1)`}
              fill={light ? '#3e5694' : '#9db7f1'}
              fontSize={groupLabelSize}
            >
              {box.name}
            </text>
          </g>
        ))}
        {distributions.map(({ bar: b, items }) => (
          <g key={b.id} data-testid="cad-distribution">
            {renderPrimitives(items, b.color)}
          </g>
        ))}
      </>
    ),
    [
      source,
      project,
      annotations,
      barDefinitions,
      barGeometries,
      barPresentations,
      representations,
      polylineItems,
      distributions,
      groupBoxes,
      selected,
      grip,
      stroke,
      light,
      props.showDimensions,
      props.layerContext,
      props.isolatedDetailId,
      groupedIds,
    ],
  );
  const gridStep = 10 ** Math.ceil(Math.log10(55 / view.s));
  const origin = scr({ x: 0, y: 0 });
  return (
    <div className={`cad-host ${light ? 'cad-light' : ''}`} ref={host}>
      {review.issue && (
        <div className="visibility-warning" role="status">
          {review.issue}
        </div>
      )}
      <svg
        ref={svg}
        className={`cad-svg ${tool === 'pan' || drag ? 'panning' : tool === 'select' ? 'selecting' : 'drawing'}`}
        aria-label="Área de desenho CAD"
        data-testid="cad-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onDoubleClick={() => {
          if (tool !== 'select' || props.isolatedDetailId || !lastHit.current)
            return;
          const detail = groupedDetailForObject(source, lastHit.current);
          if (detail) props.onEditDetail(detail.id);
        }}
        onPointerCancel={() => {
          setDrag(null);
          setGrip(null);
          setMarquee(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (
            props.commandActive ||
            !['select', 'pan'].includes(tool) ||
            draft.length
          ) {
            props.onFinish();
            return;
          }
          const point = fromScreen(eventScreen(e)),
            hit = hitAt(point);
          const ids =
            hit && !selected.includes(hit)
              ? toggleDetailSelection(
                  source,
                  [],
                  hit,
                  false,
                  props.isolatedDetailId,
                )
              : selected;
          if (hit && !selected.includes(hit)) setSelected(ids);
          props.onContextRequest(ids, point, { x: e.clientX, y: e.clientY });
        }}
        onWheel={(e) => {
          const p = fromScreen(eventScreen(e));
          const f = Math.exp(-e.deltaY * 0.0015);
          setView((v) => {
            const s = Math.max(0.000001, Math.min(20, v.s * f));
            return {
              s,
              x: p.x - ((p.x - v.x) * v.s) / s,
              y: p.y - ((p.y - v.y) * v.s) / s,
            };
          });
        }}
      >
        <defs>
          <pattern
            id="grid"
            x={origin.x % (gridStep * view.s)}
            y={origin.y % (gridStep * view.s)}
            width={gridStep * view.s}
            height={gridStep * view.s}
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0" cy="0" r="1" fill={light ? '#d5dbe6' : '#27344c'} />
          </pattern>
        </defs>
        {grid && <rect width="100%" height="100%" fill="url(#grid)" />}
        <g
          transform={`translate(${size.w / 2 - view.x * view.s} ${size.h / 2 + view.y * view.s}) scale(${view.s} ${-view.s})`}
        >
          {maskContent}
          {props.followInteraction && (
            <g pointerEvents="none" data-testid="follow-preview">
              <g
                data-testid="follow-reference-selection"
                stroke="#f59e0b"
                strokeWidth={3 * stroke}
              >
                {props.followInteraction.selected.map((edge, index) => {
                  const order = props.followInteraction!.chain?.order.indexOf(
                    edge.key,
                  );
                  return (
                    <g key={edge.key}>
                      <line
                        x1={edge.a.x}
                        y1={edge.a.y}
                        x2={edge.b.x}
                        y2={edge.b.y}
                      />
                      <text
                        x={0}
                        y={0}
                        stroke="none"
                        fill="#f59e0b"
                        fontSize={12 * stroke}
                        transform={`translate(${(edge.a.x + edge.b.x) / 2} ${(edge.a.y + edge.b.y) / 2}) scale(1 -1)`}
                      >
                        {order === undefined ? index + 1 : order + 1}
                      </text>
                    </g>
                  );
                })}
              </g>
              {props.followInteraction.chain?.adjustments.map((a, i) => (
                <circle
                  key={i}
                  cx={a.adjusted.x}
                  cy={a.adjusted.y}
                  r={4 * stroke}
                  fill="#f97316"
                />
              ))}
              {props.followInteraction.sidePoint && (
                <circle
                  data-testid="follow-side-point"
                  cx={props.followInteraction.sidePoint.x}
                  cy={props.followInteraction.sidePoint.y}
                  r={5 * stroke}
                  fill="#38bdf8"
                />
              )}
              {props.followInteraction.preview && (
                <g data-testid="follow-physical-preview">
                  <path
                    d={path(props.followInteraction.preview.worldSegments)}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={props.followInteraction.preview.bar.diameter}
                    opacity={0.3}
                  />
                  <path
                    d={path(props.followInteraction.preview.worldSegments)}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={2 * stroke}
                  />
                </g>
              )}
            </g>
          )}
          {props.maskCadOverlay && (
            <g pointerEvents="none">
              <g data-testid="mask-cad-limits">
                {renderPrimitives(
                  props.maskCadOverlay.limits.map((p) => ({
                    ...p,
                    resolvedStyle: p.resolvedStyle
                      ? {
                          ...p.resolvedStyle,
                          color: '#c084fc',
                          fill: 'none' as const,
                        }
                      : undefined,
                  })),
                  '#c084fc',
                  true,
                )}
              </g>
              <g data-testid="mask-cad-preview">
                {renderPrimitives(
                  props.maskCadOverlay.change,
                  props.maskCadOverlay.mode === 'trim' ? '#fb7185' : '#4ade80',
                  true,
                )}
              </g>
            </g>
          )}
          {props.previewLines && (
            <g
              data-testid="transform-preview"
              pointerEvents="none"
              opacity="0.85"
            >
              {renderPrimitives(
                props.previewLines.map((p) => ({
                  ...p,
                  resolvedStyle: p.resolvedStyle
                    ? {
                        ...p.resolvedStyle,
                        color: '#c084fc',
                        fill: 'none' as const,
                      }
                    : undefined,
                })),
                '#c084fc',
              )}
              {props.previewBase && (
                <circle
                  cx={props.previewBase.x}
                  cy={props.previewBase.y}
                  r={6 * stroke}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth={stroke}
                />
              )}
            </g>
          )}
          {ghosts.length > 0 && (
            <g
              data-testid="hidden-object-ghosts"
              pointerEvents="none"
              opacity="0.7"
            >
              {renderPrimitives(ghosts, '#f59e0b')}
            </g>
          )}
          {objectContent}
          {draft.length === 2 &&
            cursor &&
            [
              'dimension-aligned',
              'dimension-orthogonal',
              'leader',
              'section',
              'section-arc',
            ].includes(tool) && (
              <g opacity=".65">
                {renderPrimitives(
                  annotationPrimitives(
                    {
                      id: 'preview',
                      kind: tool as import('../domain/types').AnnotationKind,
                      points: [...draft, cursor],
                      label: '',
                      textHeight: 50,
                      color: '#50cddd',
                    },
                    project,
                  ),
                  '#50cddd',
                )}
              </g>
            )}
          {!props.nativeDrawing && draft.length > 0 && cursor && (
            <g
              stroke="#57d8de"
              strokeWidth={1.5 * stroke}
              fill="none"
              strokeDasharray={`${5 * stroke} ${4 * stroke}`}
            >
              {tool === 'stirrup' ? (
                <rect
                  x={Math.min(draft[0].x, cursor.x)}
                  y={Math.min(draft[0].y, cursor.y)}
                  width={Math.abs(cursor.x - draft[0].x)}
                  height={Math.abs(cursor.y - draft[0].y)}
                />
              ) : (
                <path
                  d={[...draft, cursor]
                    .map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`)
                    .join(' ')}
                />
              )}
            </g>
          )}
          {snapPoint && (
            <rect
              x={snapPoint.x - 5 * stroke}
              y={snapPoint.y - 5 * stroke}
              width={10 * stroke}
              height={10 * stroke}
              fill="none"
              stroke="#44dec0"
              strokeWidth={stroke}
            />
          )}
          {marquee && (
            <rect
              x={Math.min(marquee.start.x, marquee.end.x)}
              y={Math.min(marquee.start.y, marquee.end.y)}
              width={Math.abs(marquee.end.x - marquee.start.x)}
              height={Math.abs(marquee.end.y - marquee.start.y)}
              fill="#4b71e8"
              fillOpacity="0.12"
              stroke="#4b71e8"
              strokeWidth={stroke}
            />
          )}
        </g>
        {cursor && tool !== 'select' && tool !== 'pan' && (
          <g
            stroke={light ? '#8090ab' : '#60718d'}
            opacity="0.65"
            pointerEvents="none"
          >
            <line
              x1={scr(cursor).x - 20}
              x2={scr(cursor).x + 20}
              y1={scr(cursor).y}
              y2={scr(cursor).y}
            />
            <line
              x1={scr(cursor).x}
              x2={scr(cursor).x}
              y1={scr(cursor).y - 20}
              y2={scr(cursor).y + 20}
            />
          </g>
        )}
      </svg>
      <div className="canvas-heading">
        <span className="live-dot" /> MODELO 2D{' '}
        <span className="canvas-slash">/</span>
        <span>Dimensões em milímetros</span>
      </div>
      <div className="canvas-context">
        <span>VISTA SUPERIOR</span>
        <b>XY</b>
      </div>
      {project.bars.length === 0 &&
        project.masks.length === 0 &&
        project.polylines.length === 0 &&
        project.annotations.length === 0 && (
          <div className="canvas-empty">
            <Crosshair size={40} />
            <h2>Seu próximo detalhe começa aqui.</h2>
            <p>Importe uma fôrma DXF/DWG ou desenhe sua primeira armadura.</p>
            <button onClick={() => props.setTool('bar')}>Desenhar barra</button>
          </div>
        )}
      <div className="axis-widget">
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
        <i />
      </div>
      <div className="canvas-tools">
        <button
          title="Selecionar (V)"
          aria-label="Selecionar"
          className={tool === 'select' ? 'active' : ''}
          onClick={() => props.setTool('select')}
        >
          <MousePointer2 size={16} />
        </button>
        <button
          title="Pan (H)"
          aria-label="Pan"
          onClick={() => props.setTool('pan')}
        >
          <Hand size={16} />
        </button>
        <span />
        <button
          title="Afastar"
          aria-label="Afastar"
          onClick={() => setView((v) => ({ ...v, s: v.s / 1.3 }))}
        >
          <Minus size={15} />
        </button>
        <button
          title="Ajustar à tela (F)"
          aria-label="Ajustar à tela"
          onClick={fit}
        >
          <Maximize2 size={16} />
        </button>
        <button
          title="Aproximar"
          aria-label="Aproximar"
          onClick={() => setView((v) => ({ ...v, s: v.s * 1.3 }))}
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="canvas-scale">
        {format(gridStep, 0)} mm <span />
      </div>
    </div>
  );
});
