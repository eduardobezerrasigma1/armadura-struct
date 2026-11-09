import MatchPropertiesPanel, {
  type MatchSession,
} from './components/MatchPropertiesPanel';
import {
  graphicEntities,
  previewMatchProperties,
  applyMatchProperties,
  type MatchPlan,
  type GraphicRef,
} from './domain/matchProperties';
import MaskOffsetPanel, {
  type MaskOffsetSession,
} from './components/MaskOffsetPanel';
import {
  previewMaskOffset,
  applyMaskOffset,
  parseOffsetDistance,
  measuredOffsetDistance,
  type MaskOffsetPlan,
} from './domain/maskOffset';
import MaskManipPanel, {
  type MaskManipSession,
} from './components/MaskManipPanel';
import {
  maskManipNames,
  maskManipSelection,
  previewMaskManipulation,
  applyMaskManipulation,
  type MaskManipMode,
  type MaskManipPlan,
  type MaskCopyTransform,
} from './domain/maskManipulation';
import { maskPoint, maskPrimitives } from './cad/import';
import MaskCadPanel, { type MaskCadSession } from './components/MaskCadPanel';
import {
  maskCadEntities,
  maskEditTarget,
  sameMaskEntity,
  hitMaskCadEntity,
  previewMaskCadEdit,
  applyMaskCadEdit,
  curvePrimitive,
  type MaskEntityRef,
  type MaskCadMode,
  type MaskCadPlan,
} from './domain/maskCadEditing';
import MaskCalibrationPanel, {
  type MaskCalibrationSession,
  type MaskCalibrationPreview,
} from './components/MaskCalibrationPanel';
import {
  calibrationTarget,
  calibrationDistance,
  calibratedMask,
  applyMaskCalibration,
} from './domain/maskCalibration';
import MaskBatchDialog, {
  type MaskBatchRequest,
} from './components/MaskBatchDialog';
import MaskBatchResults, {
  type MaskBatchReceipt,
} from './components/MaskBatchResults';
import {
  importMaskBatch,
  associateMasks,
  type MaskAssignment,
} from './domain/maskBatch';
import CadSettingsDialog from './components/CadSettingsDialog';
import {
  cadDefaults,
  barCadDefaults,
  annotationCadDefaults,
  setCadDefaults,
} from './domain/cadDefaults';
import FollowFormPanel, {
  type FollowDraftValues,
} from './components/FollowFormPanel';
import {
  MAX_FOLLOW_EDGES,
  buildFollowChain,
  chooseFollowSide,
  followEdges,
  previewFollow,
  type FollowEdge,
} from './domain/followForm';
import MaskControl from './components/MaskControl';
import MaskDestination from './components/MaskDestination';
import {
  appendMaskShape,
  assertLocalMaskEdit,
  createDrawingMask,
  maskDrawingState,
  maskPath,
  type MaskDrawingContext,
} from './domain/maskDrawing';
import type { Mask } from './domain/types';
import {
  nativeWorldPrimitive,
  shapeFromWorld,
  type NativeShape,
  type NativeDrawKind,
} from './domain/nativeMasks';
import { prepareProjectSetup } from './domain/projectSetup';
import SheetSchedulePanel, {
  type SheetScheduleRequest,
} from './components/SheetSchedulePanel';
import {
  defaultSheetSchedule,
  setSheetSchedule,
  sheetScheduleGeometry,
} from './domain/sheetSchedule';
import { sheetScheduleIssues } from './domain/paper';
import AlignmentPanel, {
  type AlignmentSession,
} from './components/AlignmentPanel';
import VertexPanel, {
  type VertexSession,
  dimensionalMode,
  initialDimensions,
  vertexSessionEdits,
} from './components/VertexPanel';
import { terminalExtensionAt, parseLength } from './domain/segments';
import {
  alignSelection,
  modelAlignmentItems,
  paperAlignmentItems,
} from './domain/alignment';
import { editVertices, editablePath, vertexEditAt } from './domain/vertices';
import { objectPrimitives } from './domain/drawingPrimitives';
import CadContextMenu, {
  type ContextAction,
} from './components/CadContextMenu';
import TransformPanel, {
  sessionTransform,
  type TransformSession,
} from './components/TransformPanel';
import { transformSelection, selectionTransformIds } from './domain/transforms';
import { drawingPrimitives } from './domain/drawingPrimitives';
import { objectState, layerState } from './domain/layerProfiles';
import {
  assertVisibilityEdit,
  canCaptureObject,
  hideObjects,
  isolateObjects,
  endObjectIsolation,
  showAllObjects,
  setVisibility,
  visibilityState,
} from './domain/visibility';
import { assertLayerEdit } from './domain/layerProfiles';
import { layerObjects } from './domain/layers';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  CircleHelp,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  Moon,
  Redo2,
  Save,
  Sun,
  Table2,
  Terminal,
  Undo2,
  X,
  PanelRight,
  Focus,
  LockKeyhole,
  RefreshCw,
  Shapes,
} from 'lucide-react';
const NewProjectDialog = lazy(() => import('./components/NewProjectDialog'));
const DetailTransferDialog = lazy(
  () => import('./components/DetailTransferDialog'),
);
const CadInterpretDialog = lazy(
  () => import('./components/CadInterpretDialog'),
);
const VisibilityDialog = lazy(() => import('./components/VisibilityDialog'));
const PlotDialog = lazy(() => import('./components/PlotDialog'));
const LayerManager = lazy(() => import('./components/LayerManager'));
const ArmatureCloneDialog = lazy(
  () => import('./components/ArmatureCloneDialog'),
);
import type { CloneRequest } from './components/ArmatureCloneDialog';
const ExampleReviewDialog = lazy(
  () => import('./components/ExampleReviewDialog'),
);
import {
  initialExampleProject,
  INITIAL_EXAMPLE_ID,
  INITIAL_EXAMPLE_SHEETS,
} from './examples/initial';
const NumberingDialog = lazy(() => import('./components/NumberingDialog'));
const FabricationDialog = lazy(() => import('./components/FabricationDialog'));
const DetailRepetitionDialog = lazy(
  () => import('./components/DetailRepetitionDialog'),
);
import { applyCadInterpretation, type CadInterpretation } from './cad/assisted';
import {
  applyRebarBatch,
  executeRebarBatch,
  rebarDefinition,
  RebarApiError,
  validateRebarChange,
  type RebarCommand,
  type RebarPatch,
} from './domain/rebarApi';
import {
  applyDetailTransfer,
  type TransferPlan,
} from './domain/detailTransfer';
import Ribbon, { type Action } from './components/Ribbon';
import CadCanvas, {
  type CadHandle,
  type CadState,
} from './components/CadCanvas';
import SheetCanvas from './components/SheetCanvas';
import SheetManager from './components/SheetManager';
import { removePlacement, updatePlacement } from './domain/sheets';
import {
  Inspector,
  NumberField,
  ProjectTree,
  Schedule,
  DraftInspector,
  RepresentationInspector,
} from './components/Panels';
import {
  decodeProject,
  emptyProject,
  newBar,
  nextMark,
  scheduleChanged,
  createScheduleLock,
} from './domain/model';
import {
  add,
  distance,
  format,
  rotate,
  sub,
  vertices,
  geometry,
  world,
} from './domain/geometry';
import {
  uid,
  type Bar,
  type Point,
  type Primitive,
  type Project,
  type Tool,
  type Annotation,
} from './domain/types';
import {
  autosave,
  readDocumentWorkspace,
  readProjectFile,
  readDetailSourceFile,
  saveDocumentWorkspace,
  maskFileSources,
  type MaskSource,
  pickNativeFile,
  restore,
  safeName,
  saveFile,
} from './lib/files';
import { annotationError } from './domain/drafting';
import { completeOwnership, detailPath } from './domain/hierarchy';
import { drawingLabel } from './domain/hierarchyPresentation';
import {
  assertDetailEdit,
  canEditDetailChange,
  detailObjectIds,
  expandDetailSelection,
  groupInDetail,
  groupedDetailForObject,
  setDetailGrouped,
} from './domain/detailEditing';
import { version as appVersion } from '../package.json';
type DocumentSession = {
  selected: string[];
  maskId: string | null;
  tool: Tool;
  draft: Point[];
  page: 'drawing' | 'schedule';
  command: string;
  detailId: string;
  isolation?: string;
  camera?: CadState;
  selectedView?: string;
  sidebar: 'project' | 'properties' | 'sheets';
  returnTo?: string;
  settings?: {
    defaultsKey?: string;
    diameter: number;
    quantity: number;
    spacing: number;
    cover: number;
    snap: boolean;
    ortho: boolean;
    ribbon: string;
  };
};
type FollowRequest = {
  project: Project;
  document: string;
  detailId: string;
  scope?: string;
  edges: FollowEdge[];
  mode: 'edges' | 'side';
  whole: boolean;
  sidePoint?: Point;
  flip: boolean;
  values: FollowDraftValues;
};
type History = { past: Project[]; present: Project; future: Project[] };
const prompts: Record<Tool, string> = {
  polyline:
    'Indique os vértices da polilinha. Enter conclui; depois use Converter polilinha.',
  convert:
    'Clique em uma polilinha desenhada ou em uma entidade da máscara para converter em armadura.',
  repeat:
    'Selecione um estribo e indique o fim da repetição. O espaçamento máximo está na faixa de comandos.',
  range:
    'Indique o início e o fim da faixa ortogonal. A quantidade será vinculada ao espaçamento.',
  'dimension-aligned':
    'Indique os dois pontos medidos e a posição da linha de cota alinhada.',
  'dimension-orthogonal':
    'Indique os dois pontos medidos e a posição da cota horizontal ou vertical.',
  leader:
    'Indique o ponto de chamada, a dobra e o local do texto. A chamada acompanha a armadura selecionada.',
  section: 'Indique os extremos do corte e a posição da chamada.',
  'section-arc': 'Indique início, ponto intermediário e fim do arco de corte.',
  select: 'Selecione uma armadura para editar. Shift adiciona à seleção.',
  pan: 'Arraste para navegar. A roda do mouse aproxima e afasta.',
  bar: 'Indique os vértices da barra. Enter ou botão direito conclui.',
  stirrup: 'Indique dois cantos opostos do estribo. Dimensões medidas no eixo.',
  move: 'Indique o ponto base e o destino da seleção.',
  copy: 'Indique o ponto base e o destino da cópia.',
  detail: 'Indique onde posicionar o rebatimento da armadura.',
  distribute:
    'Indique o ponto final da distribuição. Ajuste quantidade e espaçamento no painel.',
  follow:
    'Selecione uma ou várias arestas da fôrma, escolha o lado por clique e confirme com Enter.',
  measure: 'Indique dois pontos para medir a distância.',
};
const tools: Tool[] = [
  'select',
  'pan',
  'bar',
  'stirrup',
  'move',
  'copy',
  'detail',
  'distribute',
  'follow',
  'measure',
  'polyline',
  'convert',
  'repeat',
  'range',
  'dimension-aligned',
  'dimension-orthogonal',
  'leader',
  'section',
  'section-arc',
];
export default function App() {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: emptyProject(),
    future: [],
  }));
  const p = history.present;
  const [detailTransfer, setDetailTransfer] = useState<{
    source: Project;
    fileName: string;
    mode: 'insert' | 'replace';
    projectId: string;
    sourceDetailId?: string;
  } | null>(null);
  const [cadInterpretation, setCadInterpretation] = useState<{
    detailId: string;
    maskId?: string;
    projectId: string;
  } | null>(null);
  const [plotOpen, setPlotOpen] = useState(false);
  const [alignmentRequest, setAlignmentRequest] =
    useState<AlignmentSession | null>(null);
  const [vertexRequest, setVertexRequest] = useState<VertexSession | null>(
    null,
  );
  const [maskManip, setMaskManip] = useState<MaskManipSession | null>(null);
  const [match, setMatch] = useState<
    | (MatchSession & {
        base: Project;
        context: MaskDrawingContext;
        activeMask?: string;
        had: boolean;
      })
    | null
  >(null);
  const matchConsumed = useRef(false);
  const [maskOffset, setMaskOffset] = useState<MaskOffsetSession | null>(null);
  const offsetSuggestion = useRef('100 mm');
  const offsetConsumed = useRef(false);
  const lastOffset = useRef<{
    project: Project;
    at: Point;
    time: number;
  } | null>(null);
  const manipConsumed = useRef(false);
  const lastManipCopy = useRef<{
    project: Project;
    at: Point;
    time: number;
  } | null>(null);
  const [maskCad, setMaskCad] = useState<MaskCadSession | null>(null);
  const lastMaskCadClick = useRef<{
    project: Project;
    at: Point;
    time: number;
  } | null>(null);
  const [maskCalibration, setMaskCalibration] =
    useState<MaskCalibrationSession | null>(null);
  const calibrationConsumed = useRef(false);
  const [transformRequest, setTransformRequest] =
    useState<TransformSession | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    ids: string[];
    point: Point;
    screen: Point;
  } | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [cloneRequest, setCloneRequest] = useState<CloneRequest | null>(null);
  const [exampleReviewOpen, setExampleReviewOpen] = useState(false);
  const [numberingOpen, setNumberingOpen] = useState(false);
  const [fabricationOpen, setFabricationOpen] = useState(false);
  const [repetitionDetailId, setRepetitionDetailId] = useState<string>();
  const detailRequest = useRef<{
    mode: 'insert' | 'replace';
    projectId: string;
  } | null>(null);
  const detailInput = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<{
    projectId: string;
    active: string;
    opened: string[];
  }>({ projectId: p.id, active: 'model', opened: [] });
  const validDocument = (key: string, project = p) =>
    key === 'model' ||
    (key.startsWith('sheet:')
      ? project.sheets.some((s) => s.id === key.slice(6))
      : key.startsWith('drawing:') &&
        project.hierarchy.drawings.some((d) => d.id === key.slice(8)));
  const documentKey =
    documents.projectId === p.id && validDocument(documents.active)
      ? documents.active
      : 'model';
  const activeSheet = documentKey.startsWith('sheet:')
    ? p.sheets.find((s) => s.id === documentKey.slice(6))
    : undefined;
  const activeDrawing = documentKey.startsWith('drawing:')
    ? p.hierarchy.drawings.find((d) => d.id === documentKey.slice(8))
    : undefined;
  const sessions = useRef(new Map<string, DocumentSession>());
  const sessionsProject = useRef('');
  const [maskControl, setMaskControl] = useState(false);
  const [cadSettingsOpen, setCadSettingsOpen] = useState(false);
  const quickDefaultsRef = useRef<string>('');
  const [nativeEntity, setNativeEntity] = useState<string>();
  const [nativeKind, setNativeKind] = useState<NativeDrawKind>();
  const [nativeCursor, setNativeCursor] = useState<Point>();
  const [drawingMaskChoice, setDrawingMaskChoice] = useState({
    projectId: '',
    id: '',
  });
  const drawingMaskId =
    drawingMaskChoice.projectId === p.id ? drawingMaskChoice.id : '';
  const [creatingMask, setCreatingMask] = useState(false);
  const nativeSession = useRef<{
    project: Project;
    mask: Mask;
    context: MaskDrawingContext;
    document: string;
  } | null>(null);
  useEffect(() => {
    let id = '';
    try {
      id = localStorage.getItem(`armadurastruct.maskTarget.${p.id}`) ?? '';
    } catch {
      /* optional preference */
    }
    setDrawingMaskChoice({
      projectId: p.id,
      id: p.masks.some((m) => m.id === id) ? id : '',
    });
  }, [p.id]);
  useEffect(() => {
    if (drawingMaskChoice.projectId !== p.id) return;
    if (
      drawingMaskChoice.id &&
      !p.masks.some((m) => m.id === drawingMaskChoice.id)
    ) {
      setDrawingMaskChoice({ projectId: p.id, id: '' });
      return;
    }
    try {
      const key = `armadurastruct.maskTarget.${p.id}`;
      if (drawingMaskChoice.id) localStorage.setItem(key, drawingMaskChoice.id);
      else localStorage.removeItem(key);
    } catch {
      /* optional preference */
    }
  }, [drawingMaskChoice, p.id, p.masks]);
  const [selectedView, setSelectedView] = useState<string>();
  const [selectedSchedule, setSelectedSchedule] = useState(false);
  const [scheduleRequest, setScheduleRequest] =
    useState<SheetScheduleRequest | null>(null);
  useEffect(() => {
    setSelectedSchedule(false);
    setScheduleRequest((s) =>
      s && s.projectId === p.id && documentKey === `sheet:${s.sheetId}`
        ? s
        : null,
    );
  }, [p.id, documentKey]);
  const visibilityKey =
    activeSheet && selectedView ? `view:${selectedView}` : documentKey;
  const currentVisibility = visibilityState(p, visibilityKey);
  const historyRef = useRef(history);
  // Reject writes synchronously, including callbacks completing after a context switch.
  historyRef.current = history;
  const [isolation, setIsolation] = useState<{
    projectId: string;
    detailId: string;
  } | null>(null);
  const isolatedDetailId =
    activeDrawing?.detailId ??
    (isolation?.projectId === p.id &&
    p.hierarchy.details.some((d) => d.id === isolation.detailId)
      ? isolation.detailId
      : undefined);
  const canUndo = canEditDetailChange(p, history.past.at(-1), isolatedDetailId);
  const canRedo = canEditDetailChange(p, history.future[0], isolatedDetailId);
  const isolationRef = useRef(isolatedDetailId);
  isolationRef.current = isolatedDetailId;
  const [context, setContext] = useState<{
    projectId: string;
    detailId: string;
  } | null>(null);
  let preferredDetail = context?.projectId === p.id ? context.detailId : '';
  if (context?.projectId !== p.id) {
    try {
      preferredDetail =
        localStorage.getItem(`armadurastruct.activeDetail.${p.id}`) || '';
    } catch {
      /* Use the first detail. */
    }
  }
  const activeDetailId =
    isolatedDetailId ||
    (p.hierarchy.details.some((d) => d.id === preferredDetail)
      ? preferredDetail
      : p.hierarchy.details[0].id);
  const activateDetail = (detailId: string) => {
    if (isolationRef.current && detailId !== isolationRef.current) return;
    setContext({ projectId: p.id, detailId });
  };
  useEffect(() => {
    try {
      localStorage.setItem(
        `armadurastruct.activeDetail.${p.id}`,
        activeDetailId,
      );
    } catch {
      /* Optional navigation preference. */
    }
  }, [p.id, activeDetailId]);
  const recoveryBlocked = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false),
    [selected, setSelectedRaw] = useState<string[]>([]),
    [maskId, setMaskId] = useState<string | null>(null);
  const [tool, setToolRaw] = useState<Tool>('select'),
    [draft, setDraft] = useState<Point[]>([]),
    [tab, setTab] = useState('Armaduras'),
    [page, setPageRaw] = useState<'drawing' | 'schedule'>('drawing');
  const [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(true),
    [ortho, setOrtho] = useState(false),
    [dimensions, setDimensions] = useState(true);
  const [light, setLight] = useState(
    () => localStorage.getItem('armadurastruct.canvas') === 'light',
  );
  const [command, setCommand] = useState(''),
    [message, setMessage] = useState('Pronto para detalhar.'),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(''),
    [saveState, setSaveState] = useState('Salvo neste computador');
  const [modal, setModal] = useState<'new' | 'help' | 'split' | 'group' | null>(
      null,
    ),
    [cover, setCover] = useState(30),
    [newDiameter, setNewDiameter] = useState(8),
    [newQuantity, setNewQuantity] = useState(1),
    [newSpacing, setNewSpacing] = useState(150),
    [splitAt, setSplitAt] = useState(500),
    [lap, setLap] = useState(0);
  const [followRequest, setFollowRequest] = useState<FollowRequest | null>(
    null,
  );
  const followConsumed = useRef(false);
  useEffect(() => {
    const identity = p.id + ':' + JSON.stringify(p.cadDefaults ?? null);
    if (quickDefaultsRef.current === identity) return;
    quickDefaultsRef.current = identity;
    const c = cadDefaults(p).armatures;
    setCover(c.cover);
    setNewDiameter(c.diameter);
    setNewQuantity(c.quantity);
    setNewSpacing(c.spacing);
    setCadSettingsOpen(false);
  }, [p.id, p.cadDefaults]);
  const [sidebarTab, setSidebarTab] = useState<
    'project' | 'properties' | 'sheets'
  >('project');
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem('armadurastruct.sidebar') !== 'closed',
  );
  const [ribbonCollapsed, setRibbonCollapsed] = useState(
    () => localStorage.getItem('armadurastruct.ribbon') === 'collapsed',
  );
  const [focus, setFocus] = useState(false);
  const [groupName, setGroupName] = useState('Detalhamento'),
    [groupElementId, setGroupElementId] = useState('');
  useEffect(
    () =>
      localStorage.setItem(
        'armadurastruct.sidebar',
        sidebarOpen ? 'open' : 'closed',
      ),
    [sidebarOpen],
  );
  useEffect(
    () =>
      localStorage.setItem(
        'armadurastruct.ribbon',
        ribbonCollapsed ? 'collapsed' : 'open',
      ),
    [ribbonCollapsed],
  );
  const paperCanvas = useRef<CadHandle>(null);
  const cad = useRef<CadHandle>(null),
    maskInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    cmdInput = useRef<HTMLInputElement>(null);
  const canvas = () => (activeSheet ? paperCanvas.current : cad.current);
  const captureDocument = (): DocumentSession => ({
    selected,
    maskId: maskOffset || match ? null : maskId,
    tool: nativeKind || tool === 'follow' ? 'select' : tool,
    draft: nativeKind ? [] : draft,
    page,
    command: nativeKind || maskOffset || match ? '' : command,
    detailId: activeDetailId,
    isolation: activeDrawing ? undefined : isolatedDetailId,
    camera: canvas()?.getState() ?? sessions.current.get(documentKey)?.camera,
    selectedView,
    settings: {
      defaultsKey: JSON.stringify(p.cadDefaults ?? null),
      diameter: newDiameter,
      quantity: newQuantity,
      spacing: newSpacing,
      cover,
      snap,
      ortho,
      ribbon: tab,
    },
    sidebar: sidebarTab,
    returnTo: sessions.current.get(documentKey)?.returnTo,
  });
  const persistDocuments = (
    active = documentKey,
    opened = documents.opened,
  ) => {
    const cameras = Object.fromEntries(
      [...sessions.current]
        .filter(([, v]) => v.camera)
        .map(([key, value]) => [key, value.camera!]),
    );
    saveDocumentWorkspace(p.id, { active, opened, cameras });
  };
  const setPage = (next: 'drawing' | 'schedule') => {
    if (next !== page)
      sessions.current.set(documentKey, { ...captureDocument(), page: next });
    setPageRaw(next);
  };
  const switchDocument = (key: string, returnTo?: string) => {
    const current = historyRef.current.present;
    if (!validDocument(key, current)) return;
    if (
      key === documentKey &&
      documents.active === key &&
      documents.projectId === p.id
    ) {
      setPage('drawing');
      return;
    }
    if (validDocument(documents.active) && documents.projectId === p.id)
      sessions.current.set(documentKey, captureDocument());
    const drawing = key.startsWith('drawing:')
      ? current.hierarchy.drawings.find((d) => d.id === key.slice(8))
      : undefined;
    const next = sessions.current.get(key) ?? {
      selected: [],
      maskId: null,
      tool: 'select' as Tool,
      draft: [],
      page: 'drawing' as const,
      command: '',
      detailId: drawing?.detailId ?? activeDetailId,
      sidebar: key.startsWith('sheet:')
        ? ('sheets' as const)
        : ('project' as const),
      returnTo,
    };
    if (returnTo && key !== 'model') next.returnTo = returnTo;
    sessions.current.set(key, next);
    const scope =
      drawing?.detailId ??
      (current.hierarchy.details.some((d) => d.id === next.isolation)
        ? next.isolation
        : undefined);
    isolationRef.current = scope;
    setIsolation(
      scope && !drawing ? { projectId: p.id, detailId: scope } : null,
    );
    setContext({ projectId: p.id, detailId: next.detailId });
    setSelectedRaw(
      next.selected.filter(
        (id) =>
          Object.hasOwn(current.hierarchy.objectDetails, id) &&
          (!scope || current.hierarchy.objectDetails[id] === scope),
      ),
    );
    setMaskId(
      next.maskId &&
        current.masks.some(
          (m) =>
            m.id === next.maskId &&
            (!scope || current.hierarchy.objectDetails[m.id] === scope),
        )
        ? next.maskId
        : null,
    );
    if (
      next.settings &&
      next.settings.defaultsKey === JSON.stringify(p.cadDefaults ?? null)
    ) {
      setNewDiameter(next.settings.diameter);
      setNewQuantity(next.settings.quantity);
      setNewSpacing(next.settings.spacing);
      setCover(next.settings.cover);
      setSnap(next.settings.snap);
      setOrtho(next.settings.ortho);
      setTab(next.settings.ribbon);
    }
    setToolRaw(next.tool);
    setDraft(next.draft);
    setPageRaw(next.page);
    setCommand(next.command);
    setSelectedView(next.selectedView);
    setSidebarTab(next.sidebar);
    setModal(null);
    setMessage(prompts[next.tool]);
    const opened = [
      ...new Set([...documents.opened, ...(key === 'model' ? [] : [key])]),
    ];
    setDocuments({ projectId: p.id, active: key, opened });
    persistDocuments(key, opened);
  };
  const openDrawing = (id: string) =>
    switchDocument(`drawing:${id}`, documentKey);
  const closeDocument = (key: string) => {
    if (key === documentKey) switchDocument('model');
    setDocuments((d) => ({
      ...d,
      active: key === d.active ? 'model' : d.active,
      opened: d.opened.filter((k) => k !== key),
    }));
  };
  useEffect(() => {
    if (sessionsProject.current === p.id) return;
    sessionsProject.current = p.id;
    sessions.current.clear();
    const saved = readDocumentWorkspace(p.id);
    for (const [key, camera] of Object.entries(saved?.cameras ?? {})) {
      sessions.current.set(key, {
        selected: [],
        maskId: null,
        tool: 'select',
        draft: [],
        page: 'drawing',
        command: '',
        detailId: p.hierarchy.details[0].id,
        camera,
        sidebar: key.startsWith('sheet:') ? 'sheets' : 'project',
      });
    }
    if (p.id === INITIAL_EXAMPLE_ID) setSidebarTab('sheets');
    // File reopen starts outside isolated editing; cached cameras remain available.
    setDocuments({
      projectId: p.id,
      active:
        p.id === INITIAL_EXAMPLE_ID
          ? `sheet:${INITIAL_EXAMPLE_SHEETS[0]}`
          : 'model',
      opened: (
        saved?.opened ??
        (p.id === INITIAL_EXAMPLE_ID
          ? INITIAL_EXAMPLE_SHEETS.map((id) => `sheet:${id}`)
          : [])
      ).filter((key) => validDocument(key)),
    });
    isolationRef.current = undefined;
    setIsolation(null);
    setSelectedRaw([]);
    setMaskId(null);
    setToolRaw('select');
    setDraft([]);
    setPageRaw('drawing');
    setSelectedView(undefined);
    setCommand('');
  }, [p.id]);
  useEffect(() => {
    if (documents.projectId === p.id && !validDocument(documents.active))
      switchDocument('model');
  }, [p.sheets, p.hierarchy.drawings]);
  useEffect(() => {
    if (documents.projectId === p.id) persistDocuments();
  }, [documents]);
  useEffect(() => {
    const save = () => {
      sessions.current.set(documentKey, captureDocument());
      persistDocuments();
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  });
  const cursorReadout = useRef<HTMLSpanElement>(null);
  const onCursor = useCallback((point: Point) => {
    if (cursorReadout.current)
      cursorReadout.current.textContent = `X ${format(point.x, 1)}   Y ${format(point.y, 1)}   mm`;
  }, []);
  const selectedOwners = new Set(
    selected.map((id) => p.hierarchy.objectDetails[id]),
  );
  const selectedGroups = !isolatedDetailId
    ? p.hierarchy.details.filter((d) => d.grouped && selectedOwners.has(d.id))
    : [];
  const groupSelection = selectedGroups.length > 0;
  const selectedGroup =
    selectedGroups.length === 1 &&
    selected.every(
      (id) => p.hierarchy.objectDetails[id] === selectedGroups[0].id,
    )
      ? selectedGroups[0]
      : undefined;
  const editable = (id: string) =>
    !isolatedDetailId || p.hierarchy.objectDetails[id] === isolatedDetailId;
  const chosen = !groupSelection
      ? p.bars.find((b) => b.id === selected[0] && editable(b.id))
      : undefined,
    mask = !groupSelection
      ? p.masks.find((m) => m.id === maskId && editable(m.id))
      : undefined;
  const annotation = !groupSelection
    ? p.annotations.find((a) => a.id === selected[0] && editable(a.id))
    : undefined;
  const maskDrawingContext: MaskDrawingContext = {
    key: documentKey,
    detailId: activeDetailId,
    scopeDetailId: isolatedDetailId,
  };
  const drawingMaskState = maskDrawingState(
    p,
    drawingMaskId,
    maskDrawingContext,
  );
  const nativeTarget = drawingMaskState.editable
    ? drawingMaskState.mask
    : undefined;
  const [maskBatch, setMaskBatch] = useState<MaskBatchRequest | null>(null);
  const [maskReceipt, setMaskReceipt] = useState<MaskBatchReceipt | null>(null);
  useEffect(() => setMaskReceipt(null), [p.id]);
  const maskImportContext = useRef('');
  maskImportContext.current = `${p.id}:${documentKey}:${activeDetailId}`;
  const polyline = !groupSelection
    ? p.polylines.find((a) => a.id === selected[0] && editable(a.id))
    : undefined;
  const notify = (s: string) => {
    setToast(s);
    setMessage(s);
  };
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    let alive = true;
    restore()
      .then(async (raw) => {
        if (raw && alive) {
          const project = decodeProject(raw);
          setHistory({ past: [], present: project, future: [] });
        } else if (!raw) {
          const project = await initialExampleProject();
          if (alive) setHistory({ past: [], present: project, future: [] });
        }
      })
      .catch(() => {
        recoveryBlocked.current = historyRef.current.present.id;
        if (alive)
          notify(
            'Não foi possível recuperar o projeto local. Abra uma cópia salva.',
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || recoveryBlocked.current === p.id) return;
    setSaveState('Salvando…');
    const timer = setTimeout(() => {
      autosave(p)
        .then(() => setSaveState('Salvo neste computador'))
        .catch(() => {
          setSaveState('Falha no salvamento local');
          notify(
            'O armazenamento local está indisponível. Use Salvar projeto para guardar uma cópia.',
          );
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [p, ready]);
  const commit = useCallback(
    (change: (current: Project) => Project) => {
      try {
        const h = historyRef.current;
        const next = change(h.present);
        const scope = isolationRef.current;
        assertVisibilityEdit(h.present, next, visibilityKey);
        assertLayerEdit(
          h.present,
          next,
          selectedView ? `view:${selectedView}` : documentKey,
        );
        const target =
          scope ||
          (next.id === h.present.id &&
          next.hierarchy.details.some((d) => d.id === activeDetailId)
            ? activeDetailId
            : next.hierarchy.details[0].id);
        const complete = completeOwnership(next, target);
        if (
          next.id === h.present.id &&
          (next.bars !== h.present.bars ||
            next.details !== h.present.details ||
            next.annotations !== h.present.annotations ||
            next.polylines !== h.present.polylines ||
            next.layers !== h.present.layers ||
            next.masks !== h.present.masks)
        ) {
          const issues = validateRebarChange(h.present, complete);
          if (issues.length) throw new RebarApiError(issues);
        }
        if (scope) assertDetailEdit(h.present, complete, scope);
        const updated = {
          past: [...h.past.slice(-39), h.present],
          present: complete,
          future: [],
        };
        historyRef.current = updated;
        setHistory(updated);
        return true;
      } catch (e) {
        notify(
          e instanceof Error
            ? e.message
            : 'Não foi possível alterar o detalhamento.',
        );
        return false;
      }
    },
    [activeDetailId, documentKey, selectedView, visibilityKey],
  );
  const commitLayout = (change: (current: Project) => Project) => {
    sessions.current.set(documentKey, captureDocument());
    return commit(change);
  };
  useEffect(() => {
    const objects = new Map(layerObjects(p).map((o) => [o.id, o]));
    setSelectedRaw((ids) =>
      ids.filter((id) => {
        const o = objects.get(id);
        return o && canCaptureObject(p, documentKey, o.id);
      }),
    );
  }, [p.layerEnvironment, documentKey]);
  const select = (ids: string[]) => {
    if (activeSheet && ids.length) {
      notify('Abra um desenho para selecionar os objetos do modelo.');
      return;
    }
    const current = historyRef.current.present;
    const scope = isolationRef.current;
    if (
      scope &&
      ids.some((id) => current.hierarchy.objectDetails[id] !== scope)
    ) {
      setSelectedRaw([]);
      setMaskId(null);
      notify(
        'Os objetos de outro detalhamento estão protegidos. Conclua a edição para selecioná-los.',
      );
      return;
    }
    const next = expandDetailSelection(current, ids, scope).filter((id) => {
      const o = layerObjects(current).find((o) => o.id === id);
      return o && canCaptureObject(current, documentKey, o.id);
    });
    setSelectedRaw(next);
    setMaskId(null);
    const owner = current.hierarchy.objectDetails[next[0]];
    if (owner) activateDetail(owner);
    if (ids.length) setSidebarTab('properties');
  };
  const setTool = (t: Tool) => {
    setMatch(null);
    if (maskOffset) {
      setMaskId(null);
      setNativeEntity(undefined);
    }
    setMaskOffset(null);
    if (maskManip) {
      setMaskId(null);
      setNativeEntity(undefined);
    }
    setMaskManip(null);
    setMaskCad(null);
    setMaskCalibration(null);
    nativeSession.current = null;
    setNativeKind(undefined);
    setNativeCursor(undefined);
    setScheduleRequest(null);
    setAlignmentRequest(null);
    setVertexRequest(null);
    setTransformRequest(null);
    setContextMenu(null);
    if (activeSheet && t !== 'select' && t !== 'pan') {
      notify(
        'Abra o desenho com duplo clique na vista para editar os objetos.',
      );
      return;
    }
    setFollowRequest(
      t === 'follow'
        ? {
            project: historyRef.current.present,
            document: documentKey,
            detailId: activeDetailId,
            scope: isolatedDetailId,
            edges: [],
            mode: 'edges',
            whole: false,
            flip: false,
            values: {
              cover: String(cover),
              mandrel: String(newDiameter * 5),
              extra: '0',
              extraReason: '',
            },
          }
        : null,
    );
    followConsumed.current = false;
    if (t === 'follow') setTab('armaduras');
    setToolRaw(t);
    setDraft([]);
    setPage('drawing');
    setMessage(prompts[t]);
  };
  const beginDetailEdit = (detailId: string) => {
    const current = historyRef.current.present;
    if (
      isolationRef.current ||
      !current.hierarchy.details.some((d) => d.id === detailId)
    )
      return;
    isolationRef.current = detailId;
    setIsolation({ projectId: current.id, detailId });
    setContext({ projectId: current.id, detailId });
    setSelectedRaw([]);
    setMaskId(null);
    setModal(null);
    setTool('select');
    notify('Edição isolada. Os demais detalhamentos estão protegidos.');
  };
  const finishDetailEdit = () => {
    if (activeDrawing) {
      const session = captureDocument();
      sessions.current.set(documentKey, {
        ...session,
        tool: 'select',
        draft: [],
        page: 'drawing',
      });
      const target =
        session.returnTo && validDocument(session.returnTo)
          ? session.returnTo
          : 'model';
      // Switch captures the current editing state; clear only this command explicitly.
      setToolRaw('select');
      setDraft([]);
      switchDocument(target);
      const cached = sessions.current.get(documentKey);
      if (cached)
        sessions.current.set(documentKey, {
          ...cached,
          tool: 'select',
          draft: [],
          page: 'drawing',
        });
      notify(
        'Edição concluída. Todas as vistas usam o detalhamento atualizado.',
      );
      return;
    }
    const current = historyRef.current.present,
      id = isolationRef.current;
    isolationRef.current = undefined;
    setIsolation(null);
    setTool('select');
    setMaskId(null);
    setSelectedRaw(id ? detailObjectIds(current, id) : []);
    notify(
      'Edição concluída. Desenhos e quantitativos usam os dados atualizados.',
    );
  };
  const editBar = (id: string, patch: Partial<Bar>) => {
    return commit((current) => {
      const b = current.bars.find((b) => b.id === id);
      if (!b) throw new Error('Armadura inexistente.');
      const { distribution, ...fields } = patch;
      const source = patch.quantitySource ?? b.quantitySource;
      const commands: RebarCommand[] = [];
      if (Object.hasOwn(patch, 'distribution') && !distribution)
        commands.push({ type: 'distribution.remove', barId: id });
      if (Object.keys(fields).length)
        commands.push({
          type: 'bar.update',
          id,
          patch: { kind: b.kind, ...fields } as RebarPatch,
        });
      if (distribution)
        commands.push({
          type: 'distribution.set',
          barId: id,
          distribution,
          count:
            source?.kind === 'distribution' && source.mode === 'spacing'
              ? { mode: 'spacing', spacing: source.spacing }
              : {
                  mode:
                    b.distribution && source?.kind === 'manual'
                      ? 'manual'
                      : 'quantity',
                  quantity: patch.quantity ?? b.quantity,
                },
        });
      return applyRebarBatch(
        current,
        executeRebarBatch(current, commands, {
          units: 'mm',
          scopeDetailId: isolationRef.current,
          layerContext: documentKey,
        }),
      );
    });
  };
  const insertBar = (
    inputBar: Bar,
    removePolyline?: string,
    invalidateSchedule = false,
  ) => {
    const b = barCadDefaults(p, inputBar, true);
    if (
      !commit((current) => {
        const commands: RebarCommand[] = [
          {
            type: 'bar.create',
            id: b.id,
            detailId: activeDetailId,
            definition: {
              ...rebarDefinition(b),
              ...(b.distribution
                ? { quantitySource: { kind: 'manual' as const } }
                : {}),
            },
          },
        ];
        if (b.distribution)
          commands.push({
            type: 'distribution.set',
            barId: b.id,
            distribution: b.distribution,
            count:
              b.quantitySource?.kind === 'distribution' &&
              b.quantitySource.mode === 'spacing'
                ? { mode: 'spacing', spacing: b.quantitySource.spacing }
                : {
                    mode:
                      b.quantitySource?.kind === 'manual'
                        ? 'manual'
                        : 'quantity',
                    quantity: b.quantity,
                  },
          });
        const next = applyRebarBatch(
          current,
          executeRebarBatch(current, commands, {
            units: 'mm',
            schedule: invalidateSchedule ? 'invalidate-lock' : 'preserve-lock',
            scopeDetailId: isolationRef.current,
            layerContext: documentKey,
          }),
        );
        return {
          ...next,
          polylines: removePolyline
            ? next.polylines.filter((l) => l.id !== removePolyline)
            : next.polylines,
        };
      })
    )
      return false;
    select([b.id]);
    setDraft([]);
    setMessage(`${b.mark} criada. Continue desenhando ou pressione Esc.`);
    return true;
  };
  const commitRebars = (commands: RebarCommand[]) =>
    commit((current) =>
      applyRebarBatch(
        current,
        executeRebarBatch(current, commands, {
          units: 'mm',
          scopeDetailId: isolationRef.current,
          layerContext: documentKey,
        }),
      ),
    );
  const availableFollowEdges = useMemo(
    () =>
      tool === 'follow'
        ? followEdges(p, {
            key: documentKey,
            detailId: activeDetailId,
            scopeDetailId: isolatedDetailId,
          })
        : [],
    [p, documentKey, activeDetailId, isolatedDetailId, tool],
  );
  const followResult = useMemo(() => {
    if (!followRequest) return { error: '' };
    try {
      const chain = buildFollowChain(followRequest.edges);
      if (!followRequest.sidePoint) return { chain, error: '' };
      const parse = (text: string) =>
        text.trim() ? Number(text.replace(',', '.')) : NaN;
      const side = chooseFollowSide(
        chain,
        followRequest.sidePoint,
        followRequest.flip,
      );
      try {
        const preview = previewFollow(
          followRequest.edges,
          followRequest.sidePoint,
          followRequest.flip,
          {
            cover: parse(followRequest.values.cover),
            diameter: newDiameter,
            mandrel: parse(followRequest.values.mandrel),
            quantity: newQuantity,
            extra: parse(followRequest.values.extra),
            extraReason: followRequest.values.extraReason,
          },
        );
        return { chain, side, preview, error: '' };
      } catch (e) {
        return { chain, side, error: (e as Error).message };
      }
    } catch (e) {
      return { error: followRequest.edges.length ? (e as Error).message : '' };
    }
  }, [followRequest, newDiameter, newQuantity]);
  useEffect(() => {
    if (
      followRequest &&
      (followRequest.project !== p ||
        followRequest.document !== documentKey ||
        followRequest.detailId !== activeDetailId ||
        followRequest.scope !== isolatedDetailId ||
        tab !== 'armaduras' ||
        page !== 'drawing')
    ) {
      setFollowRequest(null);
      setToolRaw('select');
      notify(
        'Seguir fôrma cancelado: projeto, desenho, seleção de destino ou contexto mudou. Reinicie o comando.',
      );
    }
  }, [
    p,
    documentKey,
    activeDetailId,
    isolatedDetailId,
    tab,
    page,
    followRequest,
  ]);
  const pickFollowEdge = (key: string) => {
    if (!followRequest || followRequest.project !== historyRef.current.present)
      return;
    const hit = availableFollowEdges.find((e) => e.key === key);
    if (!hit) {
      notify('Referência indisponível neste contexto.');
      return;
    }
    const adding = followRequest.whole
      ? availableFollowEdges.filter(
          (e) =>
            e.maskId === hit.maskId && e.primitiveIndex === hit.primitiveIndex,
        )
      : [hit];
    if (adding.some((e) => e.unsupported)) {
      notify(adding.find((e) => e.unsupported)!.unsupported!);
      return;
    }
    const existing = new Set(followRequest.edges.map((e) => e.key));
    if (
      adding.filter((e) => !existing.has(e.key)).length + existing.size >
      MAX_FOLLOW_EDGES
    ) {
      notify(
        `Use até ${MAX_FOLLOW_EDGES} trechos por lançamento. Selecione apenas as arestas necessárias.`,
      );
      return;
    }
    setFollowRequest((current) => {
      if (!current) return null;
      const keys = new Set(adding.map((e) => e.key));
      const remove = adding.every((e) =>
        current.edges.some((c) => c.key === e.key),
      );
      if (
        !remove &&
        current.edges.filter((e) => !keys.has(e.key)).length + adding.length >
          MAX_FOLLOW_EDGES
      ) {
        return current;
      }
      return {
        ...current,
        sidePoint: undefined,
        flip: false,
        edges: remove
          ? current.edges.filter((e) => !keys.has(e.key))
          : [...current.edges.filter((e) => !keys.has(e.key)), ...adding],
      };
    });
  };
  const finishFollow = () => {
    const request = followRequest,
      preview = followResult.preview;
    if (!request || followConsumed.current) return;
    if (!request.edges.length) {
      notify('Selecione uma ou mais arestas da fôrma.');
      return;
    }
    if (!request.sidePoint) {
      setFollowRequest({ ...request, mode: 'side' });
      notify('Escolha o lado por clique no CAD antes de confirmar.');
      return;
    }
    if (!preview || followResult.error) {
      notify(followResult.error);
      return;
    }
    if (
      request.project !== historyRef.current.present ||
      request.document !== documentKey ||
      request.detailId !== activeDetailId ||
      request.scope !== isolatedDetailId
    ) {
      setTool('select');
      notify('O destino mudou; reinicie Seguir fôrma.');
      return;
    }
    if (
      request.edges.some(
        (e) => !availableFollowEdges.some((current) => current.key === e.key),
      )
    ) {
      notify(
        'Uma referência perdeu visibilidade/captura ou mudou. Reinicie a seleção.',
      );
      return;
    }
    followConsumed.current = true;
    const bar = {
      ...preview.bar,
      id: uid(),
      mark: nextMark(historyRef.current.present),
    };
    if (!insertBar(bar, undefined, true)) {
      followConsumed.current = false;
      return;
    }
    setFollowRequest(null);
    setToolRaw('select');
    notify(
      `Uma armadura contínua criada pela API; confira as terminações. A máscara permanece independente.${request.project.scheduleLock ? ' RA desbloqueada e recalculada.' : ''}`,
    );
  };
  const alignmentPreview = useMemo(() => {
    if (!alignmentRequest)
      return { project: undefined, lines: undefined, error: '', items: [] };
    try {
      const s = alignmentRequest;
      if (s.project !== p)
        throw new Error('O projeto mudou. Reinicie o alinhamento.');
      const result = alignSelection(p, s.ids, s.options, {
        sheetId: s.sheetId,
        layerContext: documentKey,
        scopeDetailId: isolatedDetailId,
      });
      const items = s.sheetId
        ? paperAlignmentItems(p, s.sheetId)
        : result.items;
      return {
        project: result.project,
        items,
        lines: s.sheetId
          ? undefined
          : objectPrimitives(
              result.project,
              result.items.flatMap((v) => v.ids),
            ),
        error: '',
      };
    } catch (e) {
      return {
        project: undefined,
        lines: undefined,
        error: (e as Error).message,
        items: alignmentRequest.sheetId
          ? paperAlignmentItems(
              alignmentRequest.project,
              alignmentRequest.sheetId,
            )
          : modelAlignmentItems(
              alignmentRequest.project,
              alignmentRequest.ids,
              isolatedDetailId,
            ),
      };
    }
  }, [alignmentRequest, p, documentKey, isolatedDetailId]);
  const applyAlignment = () => {
    if (
      !alignmentRequest ||
      alignmentRequest.project !== historyRef.current.present
    )
      return;
    const s = alignmentRequest;
    const result = executeRebarBatch(
      p,
      [
        {
          type: 'selection.align',
          ids: s.ids,
          options: s.options,
          sheetId: s.sheetId,
        },
      ],
      {
        units: 'mm',
        layerContext: documentKey,
        scopeDetailId: isolationRef.current,
      },
    );
    if (commit((p) => applyRebarBatch(p, result))) {
      setAlignmentRequest(null);
      notify(
        'Alinhamento aplicado em uma operação; geometria e quantitativos preservados.',
      );
    }
  };
  const vertexPreview = useMemo(() => {
    if (!vertexRequest)
      return {
        pending: p,
        lines: undefined,
        points: [] as Point[],
        anchor: undefined,
        error: '',
        warnings: [] as string[],
        operations: [] as import('./domain/vertices').VertexEdit[],
        previewBar: undefined as Bar | undefined,
        canApply: false,
      };
    const s = vertexRequest;
    let pending = s.project;
    const warnings: string[] = [];
    try {
      if (s.project !== p)
        throw new Error('O projeto mudou. Reinicie a edição de vértices.');
      const dimensional = dimensionalMode(s.mode);
      const operations =
        dimensional && !s.dimensions?.picking ? vertexSessionEdits(s) : s.edits;
      for (const edit of operations) {
        const result = editVertices(pending, s.id, edit, {
          layerContext: documentKey,
          scopeDetailId: isolatedDetailId,
        });
        pending = result.project;
        warnings.push(...result.warnings);
      }
      const path = editablePath(pending, s.id),
        anchor =
          s.mode === 'extend' || s.mode === 'lengthen'
            ? path.points[s.end === 'start' ? 0 : path.points.length - 1]
            : s.edits.at(-1)?.kind !== 'remove' &&
                s.edits.at(-1) &&
                'point' in s.edits.at(-1)!
              ? (s.edits.at(-1) as { point: Point }).point
              : path.points[0];
      let display = pending,
        error = s.issue ?? '';
      if (s.cursor && (!dimensional || s.dimensions?.picking))
        try {
          display = editVertices(
            pending,
            s.id,
            dimensional
              ? vertexSessionEdits(s, true)[0]
              : vertexEditAt(
                  pending,
                  s.id,
                  s.mode as 'insert' | 'extend' | 'remove',
                  s.cursor,
                  s.end,
                ),
            { layerContext: documentKey, scopeDetailId: isolatedDetailId },
          ).project;
        } catch (e) {
          error = (e as Error).message;
        }
      const ids = [
        s.id,
        ...display.details.filter((r) => r.barId === s.id).map((r) => r.id),
        ...display.annotations
          .filter((a) => a.barId === s.id || a.barIds?.includes(s.id))
          .map((a) => a.id),
      ];
      return {
        pending,
        points: path.points,
        anchor,
        lines: objectPrimitives(display, ids),
        error,
        warnings,
        operations,
        previewBar: display.bars.find((b) => b.id === s.id),
        canApply: dimensional
          ? operations.length > 0 &&
            !error &&
            !s.dimensions?.picking &&
            JSON.stringify(display.bars.find((b) => b.id === s.id)?.points) !==
              JSON.stringify(s.project.bars.find((b) => b.id === s.id)?.points)
          : s.edits.length > 0,
      };
    } catch (e) {
      return {
        pending,
        lines: undefined,
        points: [] as Point[],
        anchor: undefined,
        error: (e as Error).message,
        warnings,
        operations: [] as import('./domain/vertices').VertexEdit[],
        previewBar: undefined as Bar | undefined,
        canApply: false,
      };
    }
  }, [vertexRequest, p, documentKey, isolatedDetailId]);
  const applyVertex = () => {
    if (
      !vertexRequest ||
      !vertexPreview.canApply ||
      vertexRequest.project !== historyRef.current.present
    )
      return;
    const s = vertexRequest;
    const result = executeRebarBatch(
      p,
      vertexPreview.operations.map((edit) => ({
        type: 'vertices.edit' as const,
        id: s.id,
        edit,
      })),
      {
        units: 'mm',
        layerContext: documentKey,
        scopeDetailId: isolationRef.current,
        schedule: 'invalidate-lock',
      },
    );
    if (commit((p) => applyRebarBatch(p, result))) {
      setVertexRequest(null);
      notify(
        'Vértices atualizados; posição e representações preservadas. Confira cotas independentes.',
      );
    }
  };
  const transformPreview = useMemo(() => {
    if (!transformRequest) return { lines: undefined, error: '', shared: 0 };
    try {
      if (transformRequest.project !== p)
        throw new Error('O projeto mudou. Cancele e reinicie a transformação.');
      const t = sessionTransform(transformRequest),
        info = selectionTransformIds(
          p,
          transformRequest.ids,
          transformRequest.associated,
        );
      if (!t)
        return { lines: undefined, error: '', shared: info.shared.length };
      const next = transformSelection(p, transformRequest.ids, t, {
        associated: transformRequest.associated,
        layerContext: documentKey,
        scopeDetailId: isolatedDetailId,
      });
      const ids = new Set(info.ids);
      const view = {
        ...next,
        bars: next.bars.filter((o) => ids.has(o.id)),
        details: next.details.filter((o) => ids.has(o.id)),
        annotations: next.annotations.filter((o) => ids.has(o.id)),
        polylines: next.polylines.filter((o) => ids.has(o.id)),
        masks: next.masks.filter((o) => ids.has(o.id)),
      };
      return {
        lines: drawingPrimitives(view, next),
        error: '',
        shared: info.shared.length,
      };
    } catch (e) {
      return { lines: undefined, error: (e as Error).message, shared: 0 };
    }
  }, [transformRequest, p, documentKey, isolatedDetailId]);
  const applyTransform = () => {
    if (
      !transformRequest ||
      transformRequest.project !== historyRef.current.present
    ) {
      notify('O projeto mudou. Reinicie a transformação.');
      return;
    }
    try {
      const t = sessionTransform(transformRequest);
      if (!t) return;
      const result = executeRebarBatch(
        historyRef.current.present,
        [
          {
            type: 'selection.transform',
            ids: transformRequest.ids,
            transform: t,
            associated: transformRequest.associated,
          },
        ],
        {
          units: 'mm',
          layerContext: documentKey,
          scopeDetailId: isolationRef.current,
        },
      );
      if (commit((p) => applyRebarBatch(p, result))) {
        setTransformRequest(null);
        setToolRaw('select');
        notify(
          'Transformação aplicada em uma operação. Quantidades preservadas.',
        );
      }
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    setTransformRequest(null);
    setAlignmentRequest(null);
    setVertexRequest(null);
    setContextMenu(null);
  }, [p.id, documentKey, isolatedDetailId]);
  const nativeContext = useRef({ project: p.id, document: documentKey });
  const openMaskContext = (detailId: string) => {
    const current = historyRef.current.present;
    const drawing = current.hierarchy.drawings.find(
      (d) => d.detailId === detailId,
    );
    if (!drawing) {
      notify('O detalhamento desta máscara não tem desenho válido.');
      return false;
    }
    if (
      !activeSheet &&
      activeDetailId === detailId &&
      (!isolatedDetailId || isolatedDetailId === detailId)
    )
      return true;
    if (
      (isolatedDetailId || activeSheet) &&
      !window.confirm(
        `Abrir ${detailPath(current, detailId)} para trabalhar com a máscara? A edição atual será deixada; as associações serão preservadas e o comando pendente de máscara será cancelado.`,
      )
    )
      return false;
    nativeSession.current = null;
    setNativeKind(undefined);
    setNativeCursor(undefined);
    setDraft([]);
    openDrawing(drawing.id);
    notify(
      `Contexto aberto: ${detailPath(current, detailId)}. Nenhuma máscara foi movida.`,
    );
    return true;
  };
  const startMaskBatch = (
    mode: 'import' | 'associate',
    sources?: MaskSource[],
  ) => {
    const base = historyRef.current.present;
    const viewDrawing =
      activeSheet && selectedView
        ? base.hierarchy.drawings.find(
            (d) =>
              d.id ===
              base.hierarchy.placements.find(
                (v) => v.id === selectedView && v.sheetId === activeSheet.id,
              )?.drawingId,
          )
        : undefined;
    setMaskBatch({
      token: uid(),
      base,
      context: { key: documentKey, scopeDetailId: isolatedDetailId },
      owner: activeSheet ? (viewDrawing?.detailId ?? '') : activeDetailId,
      fromSheet: !!activeSheet,
      sources,
      mode,
    });
    setMaskReceipt(null);
    setMaskControl(false);
  };
  useEffect(() => {
    if (
      maskBatch &&
      (maskBatch.base !== p ||
        maskBatch.context.key !== documentKey ||
        maskBatch.context.scopeDetailId !== isolatedDetailId ||
        (!maskBatch.fromSheet && maskBatch.owner !== activeDetailId))
    ) {
      setMaskBatch(null);
      notify(
        'Preparação cancelada: o projeto, destino ou contexto mudou. Nenhuma máscara foi aplicada.',
      );
    }
  }, [p, documentKey, isolatedDetailId, activeDetailId, maskBatch]);
  const batchContext = (owner: string, general = false) => {
    if (!maskBatch || historyRef.current.present !== maskBatch.base) return;
    const d = p.hierarchy.drawings.find((d) => d.detailId === owner);
    if (!d) return;
    if (general) {
      if (
        !window.confirm(
          'Deixar a edição isolada e preparar o lote no modelo geral? A associação atual das máscaras será preservada.',
        )
      )
        return;
      sessions.current.set('model', {
        ...captureDocument(),
        detailId: owner,
        isolation: undefined,
        selected: [],
        maskId: null,
        tool: 'select',
        draft: [],
        page: 'drawing',
        selectedView: undefined,
      });
      switchDocument('model');
      isolationRef.current = undefined;
      setIsolation(null);
      setContext({ projectId: p.id, detailId: owner });
      setMaskBatch({
        ...maskBatch,
        context: { key: 'model' },
        owner,
        fromSheet: false,
      });
    } else {
      if (!openMaskContext(owner)) return;
      setMaskBatch({
        ...maskBatch,
        context: { key: `drawing:${d.id}`, scopeDetailId: owner },
        owner,
        fromSheet: false,
      });
    }
  };
  const checkBatch = () => {
    if (
      !maskBatch ||
      historyRef.current.present !== maskBatch.base ||
      maskBatch.context.key !== documentKey ||
      maskBatch.context.scopeDetailId !== isolationRef.current
    )
      throw new Error(
        'Preparação desatualizada. Reabra a importação no contexto correto.',
      );
    return maskBatch;
  };
  const applyMaskImport = (draft: Project, items: MaskAssignment[]) => {
    const request = checkBatch();
    const next = importMaskBatch(request.base, draft, items, request.context);
    if (!commit(() => next)) return false;
    setMaskBatch(null);
    setMaskReceipt({
      ids: items.map((i) => i.mask.id),
      title: `${items.length} máscara(s) importada(s)`,
    });
    setSelectedRaw([]);
    setMaskId(null);
    setToolRaw('select');
    setDraft([]);
    notify(
      'Lote aplicado. Abra um resultado para conferir unidade, enquadramento e propriedades.',
    );
    return true;
  };
  const applyMaskAssociation = (
    ids: string[],
    owner: string,
    mode: 'move' | 'copy',
  ) => {
    const request = checkBatch();
    const next = associateMasks(
      request.base,
      ids,
      owner,
      mode,
      request.context,
    );
    if (!commit(() => next)) return false;
    const changed =
      mode === 'move'
        ? ids
        : next.masks
            .filter((m) => !request.base.masks.some((old) => old.id === m.id))
            .map((m) => m.id);
    setMaskBatch(null);
    setMaskReceipt({
      ids: changed,
      title: mode === 'move' ? 'Associação atualizada' : 'Referências copiadas',
    });
    setSelectedRaw([]);
    setMaskId(null);
    setToolRaw('select');
    setDraft([]);
    return true;
  };
  const matchEntities = useMemo(
    () => (match ? graphicEntities(p, maskDrawingContext, drawingMaskId) : []),
    [p, documentKey, activeDetailId, isolatedDetailId, drawingMaskId, !!match],
  );
  const endMatch = () => {
    setMatch(null);
    setSelectedRaw([]);
    setMaskId(null);
    setNativeEntity(undefined);
    setToolRaw('select');
    setDraft([]);
  };
  const startMatch = () => {
    if (activeSheet) {
      notify('Abra um desenho antes de copiar propriedades.');
      return;
    }
    setTool('select');
    setSelectedRaw([]);
    setMaskId(null);
    setNativeEntity(undefined);
    setMaskControl(false);
    matchConsumed.current = false;
    setMatch({
      base: p,
      context: { ...maskDrawingContext },
      activeMask: drawingMaskId,
      source: undefined,
      targets: [],
      stage: 'source',
      options: {
        mode: 'binding',
        properties: ['color', 'lineType', 'lineScale', 'lineWidth'],
      },
      had: false,
    });
  };
  const matchPreview = useMemo<{ plan?: MatchPlan; error?: string }>(() => {
    if (!match?.source || match.stage !== 'targets' || !match.targets.length)
      return {};
    try {
      return {
        plan: previewMatchProperties(
          p,
          match.source,
          match.targets,
          match.options,
          maskDrawingContext,
          drawingMaskId,
        ),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [match, p, documentKey, activeDetailId, isolatedDetailId, drawingMaskId]);
  const applyMatch = () => {
    if (!match || matchConsumed.current) return;
    try {
      if (
        match.base !== historyRef.current.present ||
        match.context.key !== documentKey ||
        match.context.detailId !== activeDetailId ||
        match.context.scopeDetailId !== isolatedDetailId ||
        match.activeMask !== drawingMaskId
      )
        throw new Error(
          'Contexto/projeto mudou; reinicie Copiar propriedades.',
        );
      if (!matchPreview.plan)
        throw new Error(
          matchPreview.error ?? 'Escolha fonte, propriedades e destinos.',
        );
      const next = applyMatchProperties(
        historyRef.current.present,
        matchPreview.plan,
        maskDrawingContext,
        drawingMaskId,
      );
      if (next === p) {
        notify('Nenhuma propriedade mudou.');
        return;
      }
      matchConsumed.current = true;
      if (!commit(() => next)) {
        matchConsumed.current = false;
        return;
      }
      const base = historyRef.current.present;
      const source = graphicEntities(
        base,
        maskDrawingContext,
        drawingMaskId,
      ).find((e) => e.key === match.source?.key);
      setMatch({
        ...match,
        base,
        source,
        targets: [],
        had: true,
        issue: undefined,
      });
      notify(
        'Propriedades aplicadas em um lote. Escolha novos destinos ou Esc para concluir.',
      );
    } catch (e) {
      setMatch((v) => (v ? { ...v, issue: (e as Error).message } : v));
    }
  };
  const pickMatch = (key: string) => {
    if (!match || match.stage === 'properties') return;
    const target = matchEntities.find((e) => e.key === key);
    if (!target) return;
    matchConsumed.current = false;
    if (match.stage === 'source')
      setMatch({
        ...match,
        source: target,
        stage: 'properties',
        issue: undefined,
      });
    else if (target.key !== match.source?.key)
      setMatch({
        ...match,
        targets: match.targets.some((e) => e.key === key)
          ? match.targets.filter((e) => e.key !== key)
          : [...match.targets, target],
        issue: undefined,
      });
  };
  useEffect(() => {
    if (
      match &&
      (match.base !== p ||
        match.context.key !== documentKey ||
        match.context.detailId !== activeDetailId ||
        match.context.scopeDetailId !== isolatedDetailId ||
        match.activeMask !== drawingMaskId)
    ) {
      endMatch();
      notify('Copiar propriedades cancelado: contexto/projeto mudou.');
    }
  }, [match, p, documentKey, activeDetailId, isolatedDetailId, drawingMaskId]);
  const offsetEntities = useMemo(
    () => (maskOffset ? maskCadEntities(p, maskDrawingContext) : []),
    [p, documentKey, activeDetailId, isolatedDetailId, !!maskOffset],
  );
  const endMaskOffset = () => {
    setMaskOffset(null);
    setMaskId(null);
    setNativeEntity(undefined);
    setDraft([]);
    setToolRaw('select');
  };
  const startMaskOffset = (id = drawingMaskId) => {
    try {
      const base = historyRef.current.present,
        mask = maskEditTarget(base, id, maskDrawingContext);
      const residual = selected.length;
      setTool('select');
      setMaskControl(false);
      setTab('Máscaras');
      setPage('drawing');
      setSelectedRaw([]);
      setNativeEntity(undefined);
      setMaskId(mask.id);
      setDrawingMaskChoice({ projectId: base.id, id: mask.id });
      lastOffset.current = null;
      offsetConsumed.current = false;
      setMaskOffset({
        project: base,
        maskId: mask.id,
        context: { ...maskDrawingContext },
        stage: 'distance',
        input: offsetSuggestion.current,
        points: [],
        hadOperations: false,
      });
      notify(
        `Offset: confirme uma distância com unidade ou meça por dois pontos.${residual ? ' Seleção anterior de aço/objetos ignorada.' : ''}`,
      );
      return true;
    } catch (error) {
      notify((error as Error).message);
      return false;
    }
  };
  const confirmOffsetDistance = () => {
    if (!maskOffset) return;
    try {
      const distanceMm = parseOffsetDistance(maskOffset.input);
      lastOffset.current = null;
      offsetSuggestion.current = maskOffset.input;
      setMaskOffset({
        ...maskOffset,
        distanceMm,
        stage: 'entity',
        target: undefined,
        cursor: undefined,
        points: [],
        issue: undefined,
      });
    } catch (error) {
      setMaskOffset({ ...maskOffset, issue: (error as Error).message });
    }
  };
  const pickOffsetTarget = (ref?: MaskEntityRef) => {
    const s = maskOffset;
    if (!s) return;
    lastOffset.current = null;
    if (!ref) {
      setMaskOffset({
        ...s,
        stage: 'entity',
        target: undefined,
        cursor: undefined,
        issue: undefined,
      });
      return;
    }
    try {
      maskManipSelection(
        historyRef.current.present,
        s.maskId,
        [ref],
        maskDrawingContext,
        offsetEntities,
      );
      const e = offsetEntities.find((e) => e.ref.primitive === ref.primitive);
      if (!e?.curve)
        throw new Error(
          e?.ref.primitive.text
            ? 'Texto/anotação não suporta Offset.'
            : (e?.issue ?? 'Tipo sem suporte a Offset.'),
        );
      setMaskOffset({
        ...s,
        target: ref,
        stage: 'side',
        cursor: undefined,
        issue: undefined,
      });
    } catch (error) {
      setMaskOffset({ ...s, issue: (error as Error).message });
    }
  };
  const offsetPreview = useMemo<{
    plan?: MaskOffsetPlan;
    error?: string;
  }>(() => {
    const s = maskOffset;
    if (!s || s.stage !== 'side' || !s.target || !s.cursor) return {};
    try {
      return {
        plan: previewMaskOffset(
          s.project,
          s.maskId,
          s.target,
          s.distanceMm!,
          s.cursor,
          s.context,
          offsetEntities,
          s.pickTolerance,
        ),
      };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [maskOffset, offsetEntities]);
  const offsetLines = useMemo(
    () =>
      offsetPreview.plan
        ? maskPrimitives({
            ...offsetPreview.plan.mask,
            primitives: offsetPreview.plan.results,
          })
        : undefined,
    [offsetPreview.plan],
  );
  const offsetOverlay = useMemo(
    () =>
      maskOffset?.target
        ? {
            mode: 'trim' as const,
            limits: maskPrimitives({
              ...maskOffset.project.masks.find(
                (m) => m.id === maskOffset.maskId,
              )!,
              primitives: [maskOffset.target.primitive],
            }),
            change: [],
          }
        : undefined,
    [maskOffset?.target, maskOffset?.project],
  );
  const offsetPoint = (point: Point, ref?: MaskEntityRef, tolerance = 1e-6) => {
    const s = maskOffset;
    if (!s || offsetConsumed.current) return;
    const last = lastOffset.current;
    if (
      last?.project === historyRef.current.present &&
      Date.now() - last.time < 400 &&
      distance(last.at, point) <= Math.max(1e-6, tolerance)
    )
      return;
    try {
      if (
        s.project !== historyRef.current.present ||
        s.context.key !== documentKey ||
        s.context.detailId !== activeDetailId ||
        s.context.scopeDetailId !== isolationRef.current ||
        s.maskId !== drawingMaskId ||
        maskId !== s.maskId
      )
        throw new Error('Contexto mudou; reinicie Offset.');
      if (s.stage === 'measure') {
        const points = [...s.points, point];
        if (points.length === 2) {
          const distanceMm = measuredOffsetDistance(points[0], points[1]);
          const input = `${distanceMm} mm`;
          offsetSuggestion.current = input;
          setMaskOffset({
            ...s,
            points: [],
            input,
            distanceMm,
            stage: 'entity',
            issue: undefined,
          });
        } else setMaskOffset({ ...s, points, issue: undefined });
      } else if (s.stage === 'entity') {
        if (!ref)
          throw new Error(
            'Clique numa entidade da máscara ativa. Aço e outras máscaras não são alvos.',
          );
        pickOffsetTarget(ref);
      } else if (s.stage === 'side' && s.target) {
        const plan = previewMaskOffset(
          s.project,
          s.maskId,
          s.target,
          s.distanceMm!,
          point,
          maskDrawingContext,
          undefined,
          tolerance,
        );
        const next = applyMaskOffset(s.project, plan, maskDrawingContext);
        offsetConsumed.current = true;
        if (!commit(() => next))
          throw new Error('Offset bloqueado por contexto ou layers.');
        const present = historyRef.current.present;
        lastOffset.current = { project: present, at: point, time: Date.now() };
        setMaskOffset({
          ...s,
          project: present,
          stage: 'entity',
          target: undefined,
          cursor: undefined,
          issue: undefined,
          hadOperations: true,
        });
        setSelectedRaw([]);
        setNativeEntity(undefined);
        offsetConsumed.current = false;
        notify(
          `Offset ${format(s.distanceMm!, 6)} mm · ${plan.side} · ${plan.results.length} nova(s) entidade(s). Selecione outra entidade ou Enter para concluir. Desfazer disponível.`,
        );
      }
    } catch (error) {
      offsetConsumed.current = false;
      setMaskOffset((v) => (v ? { ...v, issue: (error as Error).message } : v));
      notify((error as Error).message);
    }
  };
  useEffect(() => {
    const s = maskOffset;
    if (
      s &&
      (s.project !== p ||
        s.context.key !== documentKey ||
        s.context.detailId !== activeDetailId ||
        s.context.scopeDetailId !== isolatedDetailId ||
        s.maskId !== drawingMaskId ||
        maskId !== s.maskId ||
        tab !== 'Máscaras' ||
        page !== 'drawing')
    ) {
      endMaskOffset();
      notify(
        'Offset cancelado: projeto, desenho, máscara ou contexto mudou. Cópias confirmadas permanecem no histórico.',
      );
    }
  }, [
    p,
    documentKey,
    activeDetailId,
    isolatedDetailId,
    drawingMaskId,
    maskId,
    tab,
    page,
    maskOffset,
  ]);
  const manipEntities = useMemo(
    () => (maskManip ? maskCadEntities(p, maskDrawingContext) : []),
    [p, documentKey, isolatedDetailId, !!maskManip],
  );
  const endMaskManip = () => {
    setMaskManip(null);
    setMaskId(null);
    setNativeEntity(undefined);
    setToolRaw('select');
    setDraft([]);
  };
  const startMaskManip = (
    mode: MaskManipMode,
    id = drawingMaskId,
    entityId?: string,
  ) => {
    try {
      const base = historyRef.current.present;
      const mask = maskEditTarget(base, id, maskDrawingContext);
      const preId = entityId ?? (maskId === id ? nativeEntity : undefined);
      const pre = preId
        ? maskCadEntities(base, maskDrawingContext).find(
            (e) => e.mask.id === id && e.ref.id === preId,
          )
        : undefined;
      if (preId && !pre)
        throw new Error(
          'Pré-seleção inválida. Selecione novamente a entidade.',
        );
      if (pre) maskManipSelection(base, mask.id, [pre.ref], maskDrawingContext);
      const ignored = selected.length;
      setTool('select');
      setMaskControl(false);
      setTab('Máscaras');
      setPage('drawing');
      setSelectedRaw([]);
      setMaskId(mask.id);
      setNativeEntity(undefined);
      setDrawingMaskChoice({ projectId: base.id, id: mask.id });
      manipConsumed.current = false;
      lastManipCopy.current = null;
      if (mode === 'erase' && pre) {
        const next = applyMaskManipulation(
          base,
          previewMaskManipulation(
            base,
            mask.id,
            [pre.ref],
            mode,
            maskDrawingContext,
          ),
          maskDrawingContext,
        );
        if (!commit(() => next))
          throw new Error('Exclusão bloqueada. Confira contexto e layers.');
        setMaskId(null);
        notify(
          `Apagada 1 entidade de ${mask.name}. Máscara preservada; Desfazer disponível.${ignored ? ' Seleção residual de objetos ignorada; aço não participa.' : ''} Cotas estáticas exigem revisão.`,
        );
        return true;
      }
      setMaskManip({
        project: base,
        maskId: mask.id,
        context: { ...maskDrawingContext },
        mode,
        stage: 'selection',
        refs: pre ? [pre.ref] : [],
        hadOperations: false,
      });
      notify(
        `${maskManipNames[mode]}: selecione entidades da máscara ${mask.name} e pressione Enter.${ignored ? ' Seleção anterior de objetos ignorada; aço não participa.' : ''}`,
      );
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  };
  const toggleManipEntity = (ref?: MaskEntityRef) => {
    const s = maskManip;
    if (!s || s.stage !== 'selection') return;
    try {
      if (!ref)
        throw new Error(
          'Clique numa entidade da máscara ativa; aço e outras máscaras não são alvos.',
        );
      maskManipSelection(
        historyRef.current.present,
        s.maskId,
        [ref],
        maskDrawingContext,
      );
      setMaskManip({
        ...s,
        refs: s.refs.some((r) => sameMaskEntity(r, ref))
          ? s.refs.filter((r) => !sameMaskEntity(r, ref))
          : [...s.refs, ref],
        issue: undefined,
      });
    } catch (e) {
      setMaskManip({ ...s, issue: (e as Error).message });
    }
  };
  useEffect(() => {
    const s = maskManip;
    if (
      s &&
      (s.project !== p ||
        s.context.key !== documentKey ||
        s.context.detailId !== activeDetailId ||
        s.context.scopeDetailId !== isolatedDetailId ||
        s.maskId !== drawingMaskId ||
        maskId !== s.maskId ||
        tab !== 'Máscaras' ||
        page !== 'drawing')
    ) {
      endMaskManip();
      notify(
        'Manipular cancelado: projeto, máscara ou contexto mudou. Operações confirmadas permanecem no histórico.',
      );
    }
  }, [
    p,
    documentKey,
    activeDetailId,
    isolatedDetailId,
    drawingMaskId,
    maskId,
    tab,
    page,
    maskManip,
  ]);
  const manipTransform = (
    s: MaskManipSession,
    at = s.cursor,
  ): MaskCopyTransform | undefined =>
    s.base && at ? { kind: 'translate', delta: sub(at, s.base) } : undefined;
  const manipPreview = useMemo<{ plan?: MaskManipPlan; error?: string }>(() => {
    if (!maskManip || maskManip.stage !== 'target') return {};
    try {
      const t = manipTransform(maskManip);
      return t
        ? {
            plan: previewMaskManipulation(
              maskManip.project,
              maskManip.maskId,
              maskManip.refs,
              maskManip.mode,
              maskManip.context,
              t,
            ),
          }
        : {};
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [maskManip]);
  const manipLines = useMemo(
    () =>
      manipPreview.plan
        ? maskPrimitives({
            ...manipPreview.plan.mask,
            primitives: manipPreview.plan.result,
          })
        : undefined,
    [manipPreview.plan],
  );
  const manipOverlay = useMemo(
    () =>
      maskManip
        ? {
            mode: 'trim' as const,
            limits: maskPrimitives({
              ...maskManip.project.masks.find(
                (m) => m.id === maskManip.maskId,
              )!,
              primitives: maskManip.refs.map((r) => r.primitive),
            }),
            change: [],
          }
        : undefined,
    [maskManip?.project, maskManip?.maskId, maskManip?.refs],
  );
  const applyManip = (at?: Point) => {
    const s = maskManip;
    if (!s || manipConsumed.current) return;
    try {
      if (
        s.project !== historyRef.current.present ||
        s.context.key !== documentKey ||
        s.context.scopeDetailId !== isolationRef.current ||
        s.maskId !== drawingMaskId ||
        maskId !== s.maskId
      )
        throw new Error('Contexto mudou. Reinicie Manipular.');
      if (
        at &&
        s.mode === 'copy' &&
        lastManipCopy.current?.project === s.project &&
        Date.now() - lastManipCopy.current.time < 400 &&
        distance(lastManipCopy.current.at, at) < 1e-6
      )
        return;
      const plan = previewMaskManipulation(
        s.project,
        s.maskId,
        s.refs,
        s.mode,
        maskDrawingContext,
        manipTransform(s, at),
      );
      const next = applyMaskManipulation(s.project, plan, maskDrawingContext);
      if (next === s.project) {
        setMaskManip({
          ...s,
          issue: 'Operação neutra: nenhum objeto alterado.',
        });
        return;
      }
      manipConsumed.current = true;
      if (!commit(() => next)) {
        manipConsumed.current = false;
        throw new Error('Operação bloqueada por contexto/layers.');
      }
      setNativeEntity(undefined);
      setSelectedRaw([]);
      if (s.mode === 'copy') {
        const present = historyRef.current.present;
        lastManipCopy.current = {
          project: present,
          at: at ?? s.cursor!,
          time: Date.now(),
        };
        setMaskManip({
          ...s,
          project: present,
          cursor: undefined,
          issue: undefined,
          hadOperations: true,
        });
        manipConsumed.current = false;
      } else endMaskManip();
      notify(
        `${maskManipNames[s.mode]}: ${s.refs.length} entidade(s) na máscara ativa. Desfazer disponível. Cotas estáticas exigem revisão.`,
      );
    } catch (e) {
      manipConsumed.current = false;
      setMaskManip((v) => (v ? { ...v, issue: (e as Error).message } : v));
      notify((e as Error).message);
    }
  };
  const finishManip = () => {
    const s = maskManip;
    if (!s) return;
    if (s.stage === 'selection') {
      try {
        maskManipSelection(s.project, s.maskId, s.refs, maskDrawingContext);
        if (s.mode === 'erase') applyManip();
        else setMaskManip({ ...s, stage: 'base', issue: undefined });
      } catch (e) {
        setMaskManip({ ...s, issue: (e as Error).message });
      }
    } else if (s.mode === 'copy' && s.stage === 'target') endMaskManip();
    else
      setMaskManip({
        ...s,
        issue:
          'Escolha os pontos pedidos; Enter não aplica uma prévia pendente.',
      });
  };
  const cadMaskEntities = useMemo(
    () => (maskCad ? maskCadEntities(p, maskDrawingContext) : []),
    [p, documentKey, isolatedDetailId, !!maskCad],
  );
  const startMaskCad = (
    mode: MaskCadMode,
    id = drawingMaskId,
    entityId?: string,
  ) => {
    try {
      const base = historyRef.current.present;
      maskEditTarget(base, id, maskDrawingContext);
      const available = maskCadEntities(base, maskDrawingContext);
      const preselectedId =
        entityId ?? (maskId === id ? nativeEntity : undefined);
      const preselected = preselectedId
        ? available.find(
            (e) => e.ref.maskId === id && e.ref.id === preselectedId && e.curve,
          )
        : undefined;
      setTool('select');
      setMaskControl(false);
      setTab('Máscaras');
      setSelectedRaw([]);
      setMaskId(id);
      setNativeEntity(undefined);
      setDrawingMaskChoice({ projectId: base.id, id });
      lastMaskCadClick.current = null;
      setMaskCad({
        project: base,
        maskId: id,
        activeAtStart: id,
        context: { ...maskDrawingContext },
        mode,
        stage: 'limits',
        limits: preselected ? [preselected.ref] : [],
        all: false,
        hadOperations: false,
      });
      notify(
        `${mode === 'trim' ? 'Ajustar — Aparar / Trim' : 'Estender — Extend'}: selecione limites e pressione Enter. Sem seleção, Enter usa referências elegíveis visíveis.`,
      );
      return true;
    } catch (e) {
      notify((e as Error).message);
      if (!p.masks.some((m) => m.id === id)) {
        setCreatingMask(false);
        setMaskControl(true);
      }
      return false;
    }
  };
  const endMaskCad = () => {
    setMaskCad(null);
    setToolRaw('select');
  };
  const toggleMaskCadLimit = (ref: MaskEntityRef) => {
    const s = maskCad;
    if (!s || s.project !== historyRef.current.present) return;
    const e = cadMaskEntities.find((e) => sameMaskEntity(e.ref, ref));
    if (!e?.curve) {
      setMaskCad({
        ...s,
        issue: e?.issue ?? 'Limite sem geometria suportada.',
      });
      return;
    }
    setMaskCad({
      ...s,
      issue: undefined,
      limits: s.limits.some((r) => sameMaskEntity(r, ref))
        ? s.limits.filter((r) => !sameMaskEntity(r, ref))
        : [...s.limits, ref],
    });
  };
  const confirmMaskCadLimits = () => {
    if (maskCad)
      setMaskCad({
        ...maskCad,
        stage: 'targets',
        all: maskCad.limits.length === 0,
        hover: undefined,
        issue: undefined,
      });
  };
  useEffect(() => {
    const s = maskCad;
    if (
      s &&
      (s.project !== p ||
        s.context.key !== documentKey ||
        s.context.detailId !== activeDetailId ||
        s.context.scopeDetailId !== isolatedDetailId ||
        s.maskId !== drawingMaskId ||
        maskId !== s.maskId ||
        tab !== 'Máscaras' ||
        page !== 'drawing')
    ) {
      endMaskCad();
      notify(
        'Ajustar/Estender cancelado: o projeto, máscara ou contexto mudou. Operações já confirmadas permanecem no histórico.',
      );
    }
  }, [
    p,
    documentKey,
    activeDetailId,
    isolatedDetailId,
    drawingMaskId,
    maskId,
    tab,
    page,
    maskCad,
  ]);
  const maskCadPreview = useMemo<{ plan?: MaskCadPlan; error?: string }>(() => {
    const s = maskCad;
    if (!s || s.stage !== 'targets' || !s.hover) return {};
    try {
      return {
        plan: previewMaskCadEdit(
          s.project,
          s.maskId,
          s.mode,
          s.hover.ref,
          s.limits,
          s.all,
          s.hover.at,
          s.context,
          cadMaskEntities,
        ),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [maskCad, cadMaskEntities]);
  const maskCadOverlay = useMemo(() => {
    if (!maskCad) return undefined;
    const refs = maskCad.all ? [] : maskCad.limits;
    return {
      mode: maskCad.mode,
      limits: refs.flatMap((r) => {
        const e = cadMaskEntities.find((e) => sameMaskEntity(e.ref, r));
        return e?.curve
          ? [
              {
                ...e.ref.primitive,
                points: e.ref.primitive.points.map((q) => maskPoint(q, e.mask)),
                text: undefined,
                closed: e.ref.primitive.closed,
              },
            ]
          : [];
      }),
      change: maskCadPreview.plan
        ? [curvePrimitive(maskCadPreview.plan.change)]
        : [],
    };
  }, [
    maskCad?.mode,
    maskCad?.all,
    maskCad?.limits,
    cadMaskEntities,
    maskCadPreview.plan,
  ]);
  const pickMaskCad = (
    ref: MaskEntityRef | undefined,
    at: Point,
    duplicateTolerance = 0.000001,
  ) => {
    const s = maskCad;
    if (!s) return;
    if (!ref) {
      setMaskCad({
        ...s,
        hover: undefined,
        issue:
          'Selecione uma entidade de máscara visível/capturável. Aço não participa deste comando.',
      });
      return;
    }
    if (s.stage === 'limits') {
      toggleMaskCadLimit(ref);
      return;
    }
    const last = lastMaskCadClick.current;
    if (
      last?.project === historyRef.current.present &&
      Date.now() - last.time < 400 &&
      distance(at, last.at) <= Math.max(0.000001, duplicateTolerance)
    )
      return;
    try {
      if (
        s.project !== historyRef.current.present ||
        s.context.key !== documentKey ||
        s.context.scopeDetailId !== isolationRef.current ||
        drawingMaskId !== s.maskId
      )
        throw new Error('O alvo/contexto mudou; reinicie o comando.');
      const plan = previewMaskCadEdit(
        s.project,
        s.maskId,
        s.mode,
        ref,
        s.limits,
        s.all,
        at,
        maskDrawingContext,
      );
      const next = applyMaskCadEdit(s.project, plan, maskDrawingContext);
      if (!commit(() => next))
        throw new Error(
          'Operação bloqueada; confira contexto, layers e visibilidade.',
        );
      const present = historyRef.current.present;
      lastMaskCadClick.current = { project: present, at, time: Date.now() };
      setMaskCad({
        ...s,
        project: present,
        hover: undefined,
        selectedTarget: undefined,
        issue: undefined,
        hadOperations: true,
      });
      notify(
        `${s.mode === 'trim' ? 'Trecho aparado' : 'Entidade estendida'} · ${format(plan.change.total, 6)} mm · ${plan.remaining.length} remanescente(s). Clique em outro trecho ou Enter para concluir; Desfazer disponível.`,
      );
    } catch (e) {
      setMaskCad((v) => (v ? { ...v, issue: (e as Error).message } : v));
      notify((e as Error).message);
    }
  };
  const startMaskCalibration = (id = drawingMaskId) => {
    try {
      const current = historyRef.current.present;
      const mask = calibrationTarget(current, id, maskDrawingContext);
      setTool('select');
      setNativeEntity(undefined);
      setMaskControl(false);
      setTab('Máscaras');
      setSelectedRaw([]);
      setMaskId(mask.id);
      calibrationConsumed.current = false;
      setMaskCalibration({
        project: current,
        mask,
        context: { ...maskDrawingContext },
        activeAtStart: drawingMaskId,
        points: [],
        input: '',
      });
      notify(
        `Ajustar escala: ${mask.name}. Escolha P1, que ficará fixo; depois P2 e a distância real em mm.`,
      );
      return true;
    } catch (e) {
      notify((e as Error).message);
      if (!p.masks.some((m) => m.id === id)) {
        setCreatingMask(false);
        setMaskControl(true);
      }
      return false;
    }
  };
  useEffect(() => {
    const s = maskCalibration;
    if (
      s &&
      (s.project !== p ||
        s.context.key !== documentKey ||
        s.context.detailId !== activeDetailId ||
        s.context.scopeDetailId !== isolatedDetailId ||
        s.activeAtStart !== drawingMaskId ||
        maskId !== s.mask.id ||
        tab !== 'Máscaras' ||
        page !== 'drawing')
    ) {
      setMaskCalibration(null);
      setToolRaw('select');
      notify(
        'Ajuste de escala cancelado: o projeto, máscara ou contexto mudou. Reinicie o comando no alvo correto.',
      );
    }
  }, [
    p,
    documentKey,
    activeDetailId,
    isolatedDetailId,
    drawingMaskId,
    maskId,
    tab,
    page,
    maskCalibration,
  ]);
  const calibrationPreview = useMemo<MaskCalibrationPreview>(() => {
    const s = maskCalibration;
    if (!s || s.points.length !== 2) return {};
    try {
      const current = calibrationDistance(s.points[0], s.points[1]);
      if (!s.input.trim()) return { current };
      try {
        return calibratedMask(
          s.mask,
          s.points[0],
          s.points[1],
          parseLength(s.input),
        );
      } catch (e) {
        return { current, error: (e as Error).message };
      }
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [maskCalibration?.mask, maskCalibration?.points, maskCalibration?.input]);
  const calibrationLines = useMemo(() => {
    if (!maskCalibration || maskCalibration.points.length !== 2)
      return undefined;
    const [p1, p2] = maskCalibration.points;
    return [
      { layer: 'CALIBRACAO_REFERENCIA', points: [p1, p2] },
      ...(calibrationPreview.endpoint
        ? [
            {
              layer: 'CALIBRACAO_RESULTADO',
              points: [p1, calibrationPreview.endpoint],
            },
          ]
        : []),
    ];
  }, [maskCalibration?.points, calibrationPreview.endpoint]);
  const applyCalibration = (input = maskCalibration?.input ?? '') => {
    const s = maskCalibration;
    if (!s || calibrationConsumed.current) return;
    try {
      if (
        s.project !== historyRef.current.present ||
        s.context.key !== documentKey ||
        s.context.scopeDetailId !== isolationRef.current ||
        s.activeAtStart !== drawingMaskId ||
        maskId !== s.mask.id
      )
        throw new Error('O alvo/contexto mudou. Reinicie o ajuste de escala.');
      if (s.points.length !== 2)
        throw new Error('Escolha P1 e P2 antes de informar a distância real.');
      const desired = parseLength(input);
      const result = applyMaskCalibration(
        s.project,
        s.mask,
        s.points[0],
        s.points[1],
        desired,
        maskDrawingContext,
      );
      calibrationConsumed.current = true;
      if (result.project !== s.project && !commit(() => result.project)) {
        calibrationConsumed.current = false;
        throw new Error(
          'Ajuste bloqueado. Confira os layers, visibilidade e contexto.',
        );
      }
      setMaskCalibration(null);
      setToolRaw('select');
      setDraft([]);
      notify(
        result.project === s.project
          ? 'Distância igual à atual: máscara preservada, sem novo histórico.'
          : `Escala ajustada: ${s.mask.name} · fator ×${format(result.factor, 9)} · distância ${format(desired, 6)} mm. P1 fixo; Desfazer disponível.`,
      );
    } catch (e) {
      calibrationConsumed.current = false;
      setMaskCalibration((v) =>
        v ? { ...v, issue: (e as Error).message } : v,
      );
      notify((e as Error).message);
    }
  };
  const activateDrawingMask = (id: string) => {
    const current = historyRef.current.present,
      target = current.masks.find((m) => m.id === id);
    if (!target) {
      notify('Máscara inexistente.');
      return false;
    }
    if (!openMaskContext(current.hierarchy.objectDetails[id])) return false;
    nativeSession.current = null;
    setNativeKind(undefined);
    setNativeCursor(undefined);
    setDraft([]);
    setDrawingMaskChoice({ projectId: current.id, id });
    setToolRaw('select');
    notify(
      `Destino ativo: ${target.name} · ${maskPath(current, id)}.${target.format !== 'NATIVE' ? ' Novos traços serão desenho local; a referência e o arquivo original serão preservados.' : ''}`,
    );
    return true;
  };
  useEffect(() => {
    if (
      nativeKind &&
      nativeContext.current.project === p.id &&
      nativeContext.current.document === documentKey
    ) {
      setDraft([]);
      setToolRaw('select');
    }
    nativeContext.current = { project: p.id, document: documentKey };
    setNativeKind(undefined);
    setNativeCursor(undefined);
    nativeSession.current = null;
  }, [p.id, documentKey, activeDetailId, tab, drawingMaskId]);
  useEffect(() => {
    setMaskControl(false);
  }, [p.id]);
  useEffect(() => {
    const session = nativeSession.current;
    if (
      session &&
      (session.project !== p ||
        session.document !== documentKey ||
        session.mask.id !== drawingMaskId)
    ) {
      nativeSession.current = null;
      setNativeKind(undefined);
      setNativeCursor(undefined);
      setDraft([]);
      setToolRaw('select');
      notify(
        'Desenho da máscara cancelado: o projeto, contexto ou destino mudou. Reinicie a ferramenta.',
      );
    }
  }, [p, documentKey, drawingMaskId]);
  const putNative = (points: Point[], closed = false) => {
    const session = nativeSession.current;
    if (!nativeTarget || !nativeKind || !session) {
      notify(drawingMaskState.reason || 'Reinicie a ferramenta da máscara.');
      return;
    }
    try {
      const next = appendMaskShape(
        session.project,
        session.mask.id,
        nativeKind,
        points,
        session.context,
        session.mask,
        closed,
      );
      nativeSession.current = null;
      if (
        commit((current) => {
          if (
            current !== session.project ||
            maskImportContext.current !==
              `${session.project.id}:${session.document}:${session.context.detailId}`
          )
            throw new Error('Destino da máscara mudou. Reinicie o desenho.');
          return next;
        })
      ) {
        setDraft([]);
        setNativeCursor(undefined);
      } else {
        setNativeKind(undefined);
        setDraft([]);
        setNativeCursor(undefined);
        setToolRaw('select');
      }
    } catch (e) {
      notify((e as Error).message);
    }
  };
  let nativePreview: Primitive[] | undefined;
  if (nativeKind && nativeTarget && draft.length && nativeCursor)
    try {
      nativePreview = [
        nativeWorldPrimitive(
          shapeFromWorld(nativeKind, [...draft, nativeCursor], nativeTarget),
          nativeTarget,
        ),
      ];
    } catch {
      /* degenerate cursor preview */
    }
  useEffect(() => {
    if (nativeKind && !nativeTarget) {
      setNativeKind(undefined);
      setDraft([]);
      setToolRaw('select');
    }
  }, [nativeKind, nativeTarget]);
  const finish = () => {
    if (match) {
      if (match.stage === 'targets') applyMatch();
      else if (match.stage === 'properties')
        setMatch({ ...match, stage: 'targets' });
      return;
    }
    if (maskOffset) {
      if (maskOffset.stage === 'distance') confirmOffsetDistance();
      else endMaskOffset();
      return;
    }
    if (maskManip) {
      finishManip();
      return;
    }
    if (maskCad) {
      if (maskCad.stage === 'limits') confirmMaskCadLimits();
      else endMaskCad();
      return;
    }
    if (maskCalibration) {
      applyCalibration();
      return;
    }
    if (tool === 'follow') {
      finishFollow();
      return;
    }
    if (nativeKind) {
      if (draft.length >= 2) putNative(draft);
      return;
    }
    if (vertexRequest) {
      applyVertex();
      return;
    }
    if (alignmentRequest) return;
    if (transformRequest) return;
    if (activeSheet) return;
    if (tool === 'polyline' && draft.length >= 2) {
      const id = uid();
      commit((p) => ({
        ...p,
        polylines: [
          ...p.polylines,
          { id, points: draft, closed: false, color: '#a5adbd' },
        ],
      }));
      select([id]);
      setDraft([]);
      return;
    }
    if (tool === 'bar' && draft.length >= 2) {
      const origin = draft[0];
      insertBar({
        ...newBar(nextMark(p)),
        quantity: newQuantity,
        diameter: newDiameter,
        mandrel: newDiameter * 5,
        origin,
        points: draft.map((v) => sub(v, origin)),
      });
    } else setDraft([]);
  };
  const onPoint = (point: Point) => {
    if (match) return;
    if (maskOffset) {
      offsetPoint(
        point,
        maskOffset.stage === 'entity'
          ? hitMaskCadEntity(
              offsetEntities,
              point,
              1e-5,
              (e) => e.mask.id === maskOffset.maskId,
            )?.ref
          : undefined,
      );
      return;
    }
    if (maskManip) {
      if (maskManip.stage === 'selection')
        toggleManipEntity(
          hitMaskCadEntity(
            manipEntities,
            point,
            0.00001,
            (e) => e.mask.id === maskManip.maskId,
          )?.ref,
        );
      else if (maskManip.stage === 'base')
        setMaskManip({
          ...maskManip,
          base: point,
          stage: 'target',
          cursor: undefined,
          issue: undefined,
        });
      else applyManip(point);
      return;
    }

    if (maskCad) {
      const hit = hitMaskCadEntity(
        cadMaskEntities,
        point,
        0.00001,
        (e) =>
          maskCad.stage === 'limits' ||
          (e.mask.id === maskCad.maskId &&
            (!maskCad.selectedTarget || maskCad.selectedTarget === e.ref.key)),
      );
      pickMaskCad(hit?.ref, point);
      return;
    }

    if (maskCalibration) {
      if (maskCalibration.points.length >= 2) return;
      try {
        if (maskCalibration.project !== historyRef.current.present)
          throw new Error('O projeto mudou. Reinicie a calibração.');
        calibrationTarget(
          historyRef.current.present,
          maskCalibration.mask.id,
          maskDrawingContext,
        );
        if (maskCalibration.points.length)
          calibrationDistance(maskCalibration.points[0], point);
        else if (
          ![point.x, point.y].every(
            (n) => Number.isFinite(n) && Math.abs(n) <= 1e9,
          )
        )
          throw new Error('Informe um P1 finito dentro dos limites do modelo.');
        setMaskCalibration({
          ...maskCalibration,
          points: [...maskCalibration.points, point],
          issue: undefined,
        });
      } catch (e) {
        setMaskCalibration({ ...maskCalibration, issue: (e as Error).message });
      }
      return;
    }
    if (tool === 'follow') {
      if (followRequest?.mode === 'side')
        setFollowRequest({ ...followRequest, sidePoint: point, flip: false });
      else
        notify('Clique nas linhas da máscara; depois escolha o lado no CAD.');
      return;
    }
    if (nativeKind) {
      if (!nativeTarget) {
        setNativeKind(undefined);
        setDraft([]);
        return;
      }
      if (!nativeSession.current)
        nativeSession.current = {
          project: historyRef.current.present,
          mask: nativeTarget,
          context: maskDrawingContext,
          document: documentKey,
        };
      if (nativeKind === 'polyline') {
        if (!draft.length || distance(draft.at(-1)!, point) > 0.000001)
          setDraft([...draft, point]);
      } else if (!draft.length) setDraft([point]);
      else putNative([draft[0], point]);
      return;
    }
    if (alignmentRequest) {
      const s = alignmentRequest;
      if (s.picking) {
        const ref = s.options.reference ?? { start: point, end: point };
        setAlignmentRequest({
          ...s,
          picking: s.picking === 'start' ? 'end' : undefined,
          options: { ...s.options, reference: { ...ref, [s.picking]: point } },
        });
      }
      return;
    }
    if (vertexRequest) {
      const s = vertexRequest;
      try {
        if (dimensionalMode(s.mode)) {
          if (s.mode !== 'lengthen' || !s.dimensions?.picking) return;
          const bar = s.project.bars.find((b) => b.id === s.id)!;
          const proposal = terminalExtensionAt(bar, s.end, point);
          editVertices(s.project, s.id, proposal.edit, {
            layerContext: documentKey,
            scopeDetailId: isolatedDetailId,
          });
          setVertexRequest({
            ...s,
            dimensions: {
              ...s.dimensions,
              length: String(proposal.amount),
              extensionInput: 'increment',
              picking: false,
            },
            cursor: undefined,
            issue: undefined,
          });
          return;
        }
        const edit = vertexEditAt(
          vertexPreview.pending,
          s.id,
          s.mode,
          point,
          s.end,
        );
        editVertices(vertexPreview.pending, s.id, edit, {
          layerContext: documentKey,
          scopeDetailId: isolatedDetailId,
        });
        setVertexRequest({
          ...s,
          edits: [...s.edits, edit],
          cursor: undefined,
          issue: undefined,
        });
      } catch (e) {
        setVertexRequest({
          ...s,
          cursor: undefined,
          issue: (e as Error).message,
        });
      }
      return;
    }
    if (transformRequest) {
      setTransformRequest((s) =>
        !s
          ? s
          : s.stage === 'base'
            ? {
                ...s,
                base: point,
                stage:
                  s.kind === 'mirror'
                    ? 'axis'
                    : s.mode === 'points'
                      ? 'reference'
                      : 'ready',
              }
            : s.stage === 'reference'
              ? { ...s, reference: point, stage: 'target' }
              : ['target', 'axis'].includes(s.stage)
                ? { ...s, target: point, stage: 'ready' }
                : s,
      );
      return;
    }
    if (tool === 'bar' || tool === 'polyline') {
      if (!draft.length || distance(draft.at(-1)!, point) > 0.01)
        setDraft([...draft, point]);
      return;
    }
    if (tool === 'stirrup') {
      if (!draft.length) {
        setDraft([point]);
        return;
      }
      const a = draft[0],
        w = Math.abs(point.x - a.x),
        h = Math.abs(point.y - a.y);
      if (w < 10 || h < 10) {
        notify('Defina largura e altura de pelo menos 10 mm.');
        return;
      }
      insertBar({
        ...newBar(nextMark(p)),
        kind: 'stirrup',
        quantity: newQuantity,
        diameter: newDiameter,
        mandrel: newDiameter * 5,
        origin: { x: Math.min(a.x, point.x), y: Math.min(a.y, point.y) },
        width: w,
        height: h,
      });
      return;
    }
    if (tool === 'measure') {
      if (!draft.length) {
        setDraft([point]);
        return;
      }
      notify(
        `Distância: ${format(distance(draft[0], point), 2)} mm · ${format(distance(draft[0], point) / 1000, 3)} m`,
      );
      setDraft([]);
      return;
    }
    if (
      [
        'dimension-aligned',
        'dimension-orthogonal',
        'leader',
        'section',
        'section-arc',
      ].includes(tool)
    ) {
      if (draft.length < 2) {
        if (!draft.length || distance(draft[0], point) > 0.01)
          setDraft([...draft, point]);
        return;
      }
      const points = [...draft, point];
      const a: Annotation = annotationCadDefaults(p, {
        id: uid(),
        kind: tool as Annotation['kind'],
        points,
        barId: chosen?.id,
        label: '',
        textHeight: 50,
        color: '#7c91b7',
      });
      const error = annotationError(a);
      if (error) {
        notify(error);
        return;
      }
      commit((p) => ({ ...p, annotations: [...p.annotations, a] }));
      select([a.id]);
      setTool('select');
      notify('Anotação criada. Edite texto e vínculo nas propriedades.');
      return;
    }
    if (tool === 'move' || tool === 'copy') {
      if (!selected.length) return;
      if (!draft.length) {
        setDraft([point]);
        return;
      }
      const delta = sub(point, draft[0]);
      let next = p;
      const selectedIds: string[] = [];
      if (tool === 'copy') {
        const request: CloneRequest = {
          projectId: p.id,
          barIds: p.bars
            .filter((b) => selected.includes(b.id))
            .map((b) => b.id),
          objectIds: selected.filter((id) => !p.bars.some((b) => b.id === id)),
          delta,
          detailId: activeDetailId,
        };
        const result = executeRebarBatch(
          p,
          [
            {
              type: 'armature.clone',
              barIds: request.barIds,
              objectIds: request.objectIds,
              delta,
              detailId: request.detailId,
            },
          ],
          { units: 'mm', scopeDetailId: isolationRef.current },
        );
        // projectId is a UI guard, never an API command field.
        if (!result.ok) {
          if (result.issues.some((i) => i.code === 'SHARED_DEPENDENCY'))
            setCloneRequest(request);
          else notify(new RebarApiError(result.issues).message);
          setTool('select');
          return;
        }
        next = result.project;
        selectedIds.push(...result.receipt.createdIds);
      } else {
        const commands: RebarCommand[] = p.bars
          .filter((b) => selected.includes(b.id))
          .map((b) => ({ type: 'bar.move', id: b.id, delta }));
        if (commands.length) {
          const result = executeRebarBatch(p, commands, {
            units: 'mm',
            scopeDetailId: isolationRef.current,
            layerContext: documentKey,
          });
          if (!result.ok) {
            notify(new RebarApiError(result.issues).message);
            return;
          }
          next = result.project;
        }
        next = {
          ...next,
          annotations: p.annotations.map((a) =>
            selected.includes(a.id)
              ? { ...a, points: a.points.map((v) => add(v, delta)) }
              : a,
          ),
          polylines: p.polylines.map((a) =>
            selected.includes(a.id)
              ? { ...a, points: a.points.map((v) => add(v, delta)) }
              : a,
          ),
          details: p.details.map((d) =>
            selected.includes(d.id)
              ? { ...d, origin: add(d.origin, delta) }
              : d,
          ),
          masks: p.masks.map((m) =>
            selected.includes(m.id)
              ? { ...m, origin: add(m.origin, delta) }
              : m,
          ),
        };
      }
      commit(() => next);
      if (tool === 'copy') select(selectedIds);
      setTool('select');
      return;
    }
    if (!chosen) {
      if (['detail', 'distribute', 'range', 'repeat'].includes(tool))
        notify('Selecione uma armadura antes de usar este comando.');
      return;
    }
    if (tool === 'repeat') {
      if (chosen.kind !== 'stirrup') {
        notify('Repetir estribo exige uma posição do tipo estribo.');
        return;
      }
      try {
        if (
          !commitRebars([
            {
              type: 'distribution.set',
              barId: chosen.id,
              distribution: { end: point, render: 'bars' },
              count: { mode: 'spacing', spacing: newSpacing },
            },
          ])
        )
          return;
        setTool('select');
      } catch (e) {
        notify((e as Error).message);
      }
      return;
    }
    if (tool === 'range') {
      if (!draft.length) {
        setDraft([point]);
        return;
      }
      const start = draft[0],
        delta = sub(point, start);
      const end =
        Math.abs(delta.x) >= Math.abs(delta.y)
          ? { x: point.x, y: start.y }
          : { x: start.x, y: point.y };
      try {
        if (
          !commitRebars([
            {
              type: 'distribution.set',
              barId: chosen.id,
              distribution: { start, end, render: 'ticks' },
              count: { mode: 'spacing', spacing: newSpacing },
            },
          ])
        )
          return;
        setTool('select');
        notify(
          'Faixa vinculada à posição; a quantidade inclui as duas extremidades.',
        );
      } catch (e) {
        notify((e as Error).message);
      }
      return;
    }
    if (tool === 'detail') {
      if (
        !commitRebars([
          { type: 'representation.create', barId: chosen.id, origin: point },
        ])
      )
        return;
      setTool('select');
      notify('Rebatimento criado. Ele permanece vinculado à posição original.');
      return;
    }
    if (tool === 'distribute') {
      if (distance(chosen.origin, point) < 1) return;
      editBar(chosen.id, {
        distribution: { ...chosen.distribution, end: point },
        ...(!chosen.distribution
          ? { quantity: Math.max(2, chosen.quantity) }
          : {}),
      });
      setTool('select');
      notify(
        'Distribuição criada. Ajuste a quantidade ou o espaçamento nas propriedades.',
      );
      return;
    }
  };
  const follow = (primitive: Primitive, polylineId?: string) => {
    try {
      const points =
        primitive.closed &&
        distance(primitive.points[0], primitive.points.at(-1)!) > 0.001
          ? [...primitive.points, primitive.points[0]]
          : primitive.points;
      const origin = points[0];
      if (points.length > 500)
        throw new Error(
          'Use um contorno com até 500 vértices para criar a armadura.',
        );
      insertBar(
        {
          ...newBar(nextMark(p)),
          origin,
          quantity: newQuantity,
          diameter: newDiameter,
          mandrel: newDiameter * 5,
          points: points.map((v) => sub(v, origin)),
        },
        polylineId,
      );
      notify('Polilinha convertida em armadura; confira as dobras.');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const exportPaper = async (ids?: string[]) => {
    try {
      const { toSheetPdf } = await import('./lib/exports');
      const data = toSheetPdf(historyRef.current.present, ids);
      const saved = await saveFile(
        `${safeName(p.name)}-pranchas.pdf`,
        data,
        'application/pdf',
        'pdf',
      );
      if (saved)
        notify('PDF vetorial exportado. Imprima em tamanho real (100%).');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Não foi possível exportar as folhas.',
      );
    }
  };
  const onDetailFile = async (file: File, request = detailRequest.current) => {
    if (!request) return;
    setBusy(`Lendo origem: ${file.name}…`);
    try {
      const { project: source, detailId: sourceDetailId } =
        await readDetailSourceFile(file);
      if (
        detailRequest.current !== request ||
        historyRef.current.present.id !== request.projectId ||
        isolationRef.current
      ) {
        notify(
          'A origem não foi aberta porque o projeto ou o contexto de edição mudou. Conclua a edição e tente novamente.',
        );
        return;
      }
      setDetailTransfer({
        source,
        fileName: file.name,
        mode: request.mode,
        projectId: request.projectId,
        sourceDetailId,
      });
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Não foi possível ler a origem do detalhamento.',
      );
    } finally {
      setBusy('');
    }
  };
  const startDetailTransfer = async (mode: 'insert' | 'replace') => {
    if (isolationRef.current) {
      notify('Conclua a edição isolada antes de importar uma revisão.');
      return;
    }
    const request = { mode, projectId: historyRef.current.present.id };
    detailRequest.current = request;
    try {
      const file = await pickNativeFile(['json']);
      if (file === undefined) detailInput.current?.click();
      else if (file) await onDetailFile(file, request);
    } catch (error) {
      detailRequest.current = null;
      notify(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o arquivo de origem.',
      );
    }
  };
  const acceptDetailTransfer = (plan: TransferPlan) => {
    if (
      isolationRef.current ||
      historyRef.current.present.id !== detailTransfer?.projectId
    ) {
      notify(
        'Conclua a edição e abra novamente a comparação no projeto de destino.',
      );
      return false;
    }
    if (!commit((current) => applyDetailTransfer(current, plan))) return false;
    const wasInsert = plan.mode === 'insert';
    setDetailTransfer(null);
    detailRequest.current = null;
    setSelectedRaw([]);
    setMaskId(null);
    setDraft([]);
    setToolRaw('select');
    setPage('drawing');
    setContext({
      projectId: historyRef.current.present.id,
      detailId: plan.targetDetailId!,
    });
    setSidebarOpen(true);
    setSidebarTab(activeSheet ? 'sheets' : 'project');
    if (wasInsert) {
      const placed = plan.project?.hierarchy.placements.find((v) =>
        plan.affectedViews.includes(v.id),
      );
      if (placed) {
        switchDocument(`sheet:${placed.sheetId}`);
        setSelectedView(placed.id);
        setSidebarTab('sheets');
      } else requestAnimationFrame(() => canvas()?.fit());
    }
    notify(
      `Detalhamento aplicado. ${plan.affectedViews.length} vista(s) vinculada(s) atualizada(s).${plan.raInvalidated ? ' RA desbloqueada e recalculada.' : ''}`,
    );
    return true;
  };
  const action = async (a: Action) => {
    if (a === 'match-properties') {
      startMatch();
      return;
    }
    if (match) {
      if (['undo', 'redo'].includes(a)) {
        const had = match.had;
        endMatch();
        if (!had) return;
      } else if (
        ![
          'fit',
          'grid',
          'snap',
          'ortho',
          'dimensions',
          'sidebar',
          'focus',
          'save',
        ].includes(a)
      ) {
        endMatch();
        return;
      }
    }
    if (a === 'mask-offset') {
      startMaskOffset();
      return;
    }
    if (
      maskOffset &&
      ['delete', 'copy', 'move', 'rotate', 'mirror', 'clone-armature'].includes(
        a,
      )
    ) {
      endMaskOffset();
      notify('Offset cancelado. Selecione alvos novamente para outro comando.');
      return;
    }
    if (maskOffset && ['undo', 'redo'].includes(a)) {
      const had = maskOffset.hadOperations;
      endMaskOffset();
      if (!had) return;
    } else if (
      maskOffset &&
      ![
        'fit',
        'grid',
        'snap',
        'ortho',
        'dimensions',
        'sidebar',
        'focus',
        'save',
      ].includes(a)
    )
      endMaskOffset();
    const manipActions: Partial<Record<Action, MaskManipMode>> = {
      'mask-copy': 'copy',
      'mask-erase': 'erase',
    };
    if (manipActions[a]) {
      startMaskManip(manipActions[a]!);
      return;
    }
    if (
      maskManip &&
      ['delete', 'copy', 'move', 'rotate', 'mirror', 'clone-armature'].includes(
        a,
      )
    ) {
      if (a === 'delete' && maskManip.mode === 'erase') finishManip();
      else {
        endMaskManip();
        notify(
          'Manipular cancelado. Escolha um comando e selecione seus alvos novamente.',
        );
      }
      return;
    }
    if (maskManip && ['undo', 'redo'].includes(a)) {
      const had = maskManip.hadOperations;
      endMaskManip();
      if (!had) {
        notify('Seleção/prévia cancelada, sem alterar o projeto.');
        return;
      }
    } else if (
      maskManip &&
      ![
        'fit',
        'grid',
        'snap',
        'ortho',
        'dimensions',
        'sidebar',
        'focus',
        'save',
      ].includes(a)
    )
      endMaskManip();

    if (a === 'mask-trim' || a === 'mask-extend') {
      startMaskCad(a === 'mask-trim' ? 'trim' : 'extend');
      return;
    }
    if (maskCad && ['undo', 'redo'].includes(a)) {
      const undoConfirmed = maskCad.hadOperations;
      endMaskCad();
      if (!undoConfirmed) {
        notify('Seleção/prévia cancelada, sem alterar o projeto.');
        return;
      }
    } else if (
      maskCad &&
      ![
        'fit',
        'grid',
        'snap',
        'ortho',
        'dimensions',
        'sidebar',
        'focus',
        'save',
      ].includes(a)
    )
      endMaskCad();

    if (a === 'mask-calibrate') {
      startMaskCalibration();
      return;
    }
    if (maskCalibration && ['undo', 'redo'].includes(a)) {
      setMaskCalibration(null);
      setToolRaw('select');
      notify('Ajuste de escala cancelado; o projeto não foi alterado.');
      return;
    }
    if (
      maskCalibration &&
      ![
        'fit',
        'snap',
        'ortho',
        'grid',
        'dimensions',
        'sidebar',
        'focus',
        'save',
      ].includes(a)
    ) {
      setMaskCalibration(null);
      setToolRaw('select');
    }

    if (a === 'import' || a === 'associate-masks') {
      startMaskBatch(a === 'import' ? 'import' : 'associate');
      return;
    }
    if (a === 'cad-settings') {
      setCadSettingsOpen(true);
      return;
    }
    if (a === 'mask-control') {
      setTool('select');
      setNativeEntity(undefined);
      setCreatingMask(false);
      setMaskControl(true);
      return;
    }
    if (a.startsWith('mask-')) {
      if (!nativeTarget || !nativeTarget.visible) {
        setTool('select');
        setSelectedRaw([]);
        setMaskId(drawingMaskId || null);
        setNativeEntity(undefined);
        setCreatingMask(false);
        setMaskControl(true);
        notify(drawingMaskState.reason);
        return;
      }
      setTool('polyline');
      setSelectedRaw([]);
      setNativeKind(a.slice(5) as NativeDrawKind);
      nativeSession.current = {
        project: historyRef.current.present,
        mask: nativeTarget,
        context: maskDrawingContext,
        document: documentKey,
      };
      setMessage(
        `${nativeTarget.name}: ${a === 'mask-circle' ? 'centro e ponto do raio' : a === 'mask-rectangle' ? 'cantos opostos' : a === 'mask-line' ? 'dois pontos' : 'vértices; Enter conclui; use Fechar polilinha para fechar'}. Coordenadas em mm.`,
      );
      return;
    }

    setContextMenu(null);
    if (followRequest && ['undo', 'redo'].includes(a)) {
      setTool('select');
      return;
    }
    if (
      (alignmentRequest || vertexRequest || scheduleRequest) &&
      ['undo', 'redo'].includes(a)
    ) {
      setScheduleRequest(null);
      setAlignmentRequest(null);
      setVertexRequest(null);
      return;
    }
    if (a === 'insert-sheet-schedule') {
      if (isolationRef.current) {
        notify(
          'Conclua a edição isolada antes de inserir o quadro na prancha.',
        );
        return;
      }
      const drawingSheet =
        activeDrawing &&
        p.hierarchy.placements.find((v) => v.drawingId === activeDrawing.id)
          ?.sheetId;
      const openedSheet = [...documents.opened]
        .reverse()
        .find(
          (key) =>
            key.startsWith('sheet:') &&
            p.sheets.some((s) => s.id === key.slice(6)),
        )
        ?.slice(6);
      const target =
        p.sheets.find(
          (s) => s.id === (activeSheet?.id ?? drawingSheet ?? openedSheet),
        ) ?? p.sheets[0];
      if (!target) {
        notify('Crie uma prancha no gerenciador para inserir o quadro de aço.');
        setSidebarTab('sheets');
        setSidebarOpen(true);
        return;
      }
      setTool('select');
      setDraft([]);
      switchDocument(`sheet:${target.id}`);
      setPageRaw('drawing');
      setSelectedView(undefined);
      setSelectedSchedule(false);
      setSidebarTab('sheets');
      const options = target.steelSchedule ?? defaultSheetSchedule();
      setScheduleRequest({
        projectId: p.id,
        sheetId: target.id,
        options: {
          textHeight: options.textHeight,
          allowancePercent: options.allowancePercent,
        },
      });
      notify(
        `Mova o cursor e clique em ${target.name} para inserir o quadro de aço.`,
      );
      return;
    }
    if (a === 'align-selection') {
      setScheduleRequest(null);
      try {
        const ids = activeSheet
          ? p.hierarchy.placements
              .filter((v) => v.sheetId === activeSheet.id)
              .map((v) => v.id)
          : selected;
        const items = activeSheet
          ? paperAlignmentItems(p, activeSheet.id)
          : modelAlignmentItems(p, ids, isolatedDetailId);
        if (items.length < 2)
          throw new Error('Selecione ao menos dois objetos ou detalhamentos.');
        setTransformRequest(null);
        setVertexRequest(null);
        setDraft([]);
        setToolRaw('select');
        setAlignmentRequest({
          project: p,
          ids,
          sheetId: activeSheet?.id,
          options: {
            mode: 'align',
            axis: 'x',
            anchor: 'min',
            fixedId: items[0].id,
            gap: activeSheet ? 10 : 100,
          },
        });
      } catch (e) {
        notify((e as Error).message);
      }
      return;
    }
    if (
      [
        'insert-vertex',
        'extend-vertex',
        'remove-vertex',
        'edit-segment',
        'lengthen-bar',
      ].includes(a)
    ) {
      try {
        if (activeSheet || selected.length !== 1 || groupSelection)
          throw new Error(
            'Selecione uma barra livre ou polilinha; abra o detalhamento agrupado para editar seus objetos.',
          );
        const path = editablePath(p, selected[0]);
        const dimension = a === 'edit-segment' || a === 'lengthen-bar';
        if (dimension && !path.bar)
          throw new Error(
            'Selecione uma barra livre física, não uma máscara, polilinha ou representação.',
          );
        setTransformRequest(null);
        setAlignmentRequest(null);
        setDraft([]);
        setToolRaw('select');
        setVertexRequest({
          project: p,
          id: selected[0],
          mode:
            a === 'edit-segment'
              ? 'segment'
              : a === 'lengthen-bar'
                ? 'lengthen'
                : a === 'insert-vertex'
                  ? 'insert'
                  : a === 'extend-vertex'
                    ? 'extend'
                    : 'remove',
          end: 'end',
          edits: [],
          dimensions: dimension
            ? initialDimensions(path.bar!, a === 'lengthen-bar')
            : undefined,
        });
        if (dimension)
          notify(
            a === 'lengthen-bar'
              ? 'Estender barra: escolha a ponta e clique para projetar ou informe o acréscimo em mm (ex.: +300 mm). FINAL 1300 mm informa o comprimento final. Enter confirma após a prévia.'
              : 'Edite comprimento/ângulo local, ponta fixa e estratégia; confira a prévia e aplique.',
          );
      } catch (e) {
        notify((e as Error).message);
      }
      return;
    }
    if (transformRequest && ['undo', 'redo'].includes(a)) {
      setTransformRequest(null);
      return;
    }
    if (a === 'rotate' || a === 'mirror') {
      setAlignmentRequest(null);
      setVertexRequest(null);
      if (activeSheet) {
        notify('Abra o desenho para transformar objetos.');
        return;
      }
      const ids = selected.length ? selected : maskId ? [maskId] : [];
      if (!ids.length) {
        notify('Selecione objetos para transformar.');
        return;
      }
      setDraft([]);
      setToolRaw('select');
      setPage('drawing');
      setTransformRequest({
        project: p,
        ids: [...ids],
        kind: a === 'rotate' ? 'rotate' : 'mirror',
        angle: 90,
        mode: 'angle',
        stage: 'base',
        associated: true,
      });
      return;
    }
    if (
      [
        'hide-objects',
        'isolate-objects',
        'end-object-isolation',
        'show-all-objects',
        'show-hidden-objects',
      ].includes(a)
    ) {
      if (activeSheet && !selectedView) {
        notify('Selecione uma vista da folha para controlar seus objetos.');
        return;
      }
      const ids = selected.length ? selected : maskId ? [maskId] : [];
      if (a === 'show-hidden-objects') {
        if (
          commit((p) => setVisibility(p, visibilityKey, { showHidden: true }))
        )
          setVisibilityOpen(true);
      } else if (a === 'show-all-objects')
        commit((p) => showAllObjects(p, visibilityKey));
      else if (a === 'end-object-isolation')
        commit((p) => endObjectIsolation(p, visibilityKey));
      else if (activeSheet || !ids.length) {
        if (
          commit((p) => setVisibility(p, visibilityKey, { showHidden: true }))
        )
          setVisibilityOpen(true);
      } else if (
        commit((p) =>
          a === 'hide-objects'
            ? hideObjects(p, visibilityKey, ids)
            : isolateObjects(p, visibilityKey, ids),
        )
      ) {
        setSelectedRaw([]);
        setMaskId(null);
        setDraft([]);
        setToolRaw('select');
      }
      return;
    }
    if (a === 'plot') {
      setPlotOpen(true);
      return;
    }
    if (a === 'layers') {
      setLayersOpen(true);
      return;
    }
    if (a === 'clone-armature') {
      const barIds = p.bars
        .filter((b) => selected.includes(b.id))
        .map((b) => b.id);
      if (!barIds.length) {
        notify('Selecione uma armadura física para duplicar o conjunto.');
        return;
      }
      setCloneRequest({
        projectId: p.id,
        barIds,
        objectIds: selected.filter((id) => !barIds.includes(id)),
        delta: { x: 1000, y: 0 },
        detailId: isolationRef.current,
      });
      return;
    }
    if (a === 'fabrication') {
      if (isolationRef.current) {
        notify(
          'Conclua a edição isolada antes de organizar as posições de fabricação.',
        );
        return;
      }
      setFabricationOpen(true);
      return;
    }
    if (a === 'detail-repetition') {
      if (isolationRef.current) {
        notify(
          'Conclua a edição isolada antes de alterar a repetição do elemento.',
        );
        return;
      }
      const view = p.hierarchy.placements.find((v) => v.id === selectedView);
      setRepetitionDetailId(
        (activeSheet && view
          ? p.hierarchy.drawings.find((d) => d.id === view.drawingId)?.detailId
          : undefined) ??
          selectedGroup?.id ??
          activeDetailId,
      );
      return;
    }
    if (a === 'export-detail') {
      try {
        const view = p.hierarchy.placements.find((v) => v.id === selectedView);
        const detailId =
          (activeSheet && view
            ? p.hierarchy.drawings.find((d) => d.id === view.drawingId)
                ?.detailId
            : undefined) ??
          selectedGroup?.id ??
          activeDetailId;
        const { createDetailPackage } = await import('./domain/detailPackage');
        const pack = createDetailPackage(p, detailId, {
          producer: { app: 'ArmaduraStruct', version: appVersion },
        });
        const saved = await saveFile(
          `${safeName(pack.context.detail.name)}.osdetail.json`,
          JSON.stringify(pack, null, 2),
          'application/json',
          'json',
        );
        if (saved)
          notify(
            'Pacote OpenStruct exportado com unidades, origem, posições e vínculos.',
          );
      } catch (e) {
        notify(
          e instanceof Error
            ? e.message
            : 'Não foi possível exportar o pacote.',
        );
      }
      return;
    }
    if (a === 'interpret-cad') {
      if (isolationRef.current && p.scheduleLock) {
        notify(
          'Conclua a edição isolada antes de interpretar CAD com a RA bloqueada; a nova posição exige recalcular o quadro.',
        );
        return;
      }
      const owner = maskId ? p.hierarchy.objectDetails[maskId] : activeDetailId;
      if (activeSheet) {
        notify('Abra o desenho para interpretar uma referência CAD.');
        return;
      }
      if (isolationRef.current && owner !== isolationRef.current) {
        notify('Escolha uma máscara do detalhamento em edição.');
        return;
      }
      if (!p.masks.some((m) => p.hierarchy.objectDetails[m.id] === owner)) {
        notify('Importe primeiro uma máscara DXF/DWG neste detalhamento.');
        return;
      }
      setCadInterpretation({
        detailId: owner,
        maskId: maskId ?? undefined,
        projectId: p.id,
      });
      return;
    }
    if (a === 'insert-detail' || a === 'update-detail') {
      await startDetailTransfer(a === 'insert-detail' ? 'insert' : 'replace');
      return;
    }
    if (a === 'pdf') {
      await exportPaper(activeSheet ? [activeSheet.id] : undefined);
      return;
    }
    if (activeSheet && a === 'delete') {
      if (selectedSchedule) {
        commitLayout((p) => setSheetSchedule(p, activeSheet.id, undefined));
        setSelectedSchedule(false);
        return;
      }
      if (selectedView) {
        commit((p) => removePlacement(p, selectedView));
        setSelectedView(undefined);
      }
      return;
    }
    if (
      activeSheet &&
      [
        'copy',
        'move',
        'rotate',
        'mirror',
        'split',
        'join',
        'group',
        'ungroup',
        'import',
      ].includes(a)
    ) {
      notify(
        'Abra o desenho com duplo clique na vista para editar os objetos.',
      );
      return;
    }
    if (
      isolationRef.current &&
      [
        'new',
        'open',
        'renumber',
        'group',
        'ungroup',
        'lock-schedule',
        'refresh-schedule',
      ].includes(a)
    ) {
      notify('Conclua a edição isolada antes de usar este comando.');
      return;
    }
    if (
      groupSelection &&
      [
        'copy',
        'rotate',
        'mirror',
        'split',
        'join',
        'detail',
        'range',
        'repeat',
        'distribute',
      ].includes(a)
    ) {
      notify(
        'Abra o detalhamento para editar ou copiar objetos individualmente.',
      );
      return;
    }
    if (a === 'finish-detail') {
      finishDetailEdit();
      return;
    }
    if (a === 'edit-detail') {
      beginDetailEdit(selectedGroup?.id || activeDetailId);
      return;
    }
    if (a === 'group') {
      if (!selected.length && !maskId) {
        notify('Selecione os objetos a agrupar.');
        return;
      }
      setGroupName('Detalhamento');
      setGroupElementId(
        p.hierarchy.details.find((d) => d.id === activeDetailId)!.elementId,
      );
      setModal('group');
      return;
    }
    if (a === 'ungroup') {
      const groups = selectedGroups;
      if (!groups.length) {
        notify('Selecione um detalhamento agrupado.');
        return;
      }
      if (
        commit((current) =>
          groups.reduce(
            (next, d) => setDetailGrouped(next, d.id, false),
            current,
          ),
        )
      )
        notify(
          'Seleção desagrupada. As armaduras e seus quantitativos foram preservados.',
        );
      return;
    }
    if (a === 'convert' && polyline) {
      setTool('convert');
      return;
    }
    if (tools.includes(a as Tool)) {
      setTool(a as Tool);
      return;
    }
    try {
      if (a === 'sidebar') {
        setSidebarOpen(!sidebarOpen);
        setFocus(false);
      }
      if (a === 'focus') setFocus(!focus);
      if (a === 'refresh-schedule') {
        commit((p) =>
          p.scheduleLock
            ? {
                ...p,
                scheduleLock: createScheduleLock(p),
              }
            : { ...p },
        );
        notify('Relação de aço atualizada a partir das armaduras.');
      }
      if (a === 'lock-schedule') {
        commit((p) => ({
          ...p,
          scheduleLock: p.scheduleLock ? undefined : createScheduleLock(p),
        }));
        notify(
          p.scheduleLock
            ? 'Relação de aço em atualização automática.'
            : 'Relação de aço bloqueada. Use Atualizar RA após editar as barras.',
        );
      }
      if (a === 'renumber') {
        setNumberingOpen(true);
        return;
      }
      if (a === 'join') {
        const next = applyRebarBatch(
          p,
          executeRebarBatch(
            p,
            [{ type: 'bar.join', ids: selected as [string, string] }],
            { units: 'mm', scopeDetailId: isolationRef.current },
          ),
        );
        if (!commit(() => next)) return;
        select([next.bars.find((b) => selected.includes(b.id))!.id]);
        notify(
          'Poligonais emendadas em uma única barra. Para emendas com traspasse, use Dividir barra.',
        );
      }
      if (a === 'split') {
        if (!chosen || selected.length !== 1 || chosen.kind !== 'free')
          throw new Error('Selecione uma barra livre para dividir.');
        setSplitAt(geometry(chosen).length / 2);
        setModal('split');
      }
      if (a === 'undo') {
        setDraft([]);
        const h = historyRef.current;
        if (
          !canEditDetailChange(h.present, h.past.at(-1), isolationRef.current)
        ) {
          notify(
            'Não há alterações deste detalhamento para desfazer. Conclua a edição para acessar o histórico geral.',
          );
          return;
        }
        const updated = h.past.length
          ? {
              past: h.past.slice(0, -1),
              present: h.past.at(-1)!,
              future: [h.present, ...h.future],
            }
          : h;
        historyRef.current = updated;
        setHistory(updated);
      }
      if (a === 'redo') {
        setDraft([]);
        const h = historyRef.current;
        if (
          !canEditDetailChange(h.present, h.future[0], isolationRef.current)
        ) {
          notify('Não há alterações deste detalhamento para refazer.');
          return;
        }
        const updated = h.future.length
          ? {
              past: [...h.past, h.present],
              present: h.future[0],
              future: h.future.slice(1),
            }
          : h;
        historyRef.current = updated;
        setHistory(updated);
      }
      if (a === 'new') setModal('new');
      if (a === 'open') {
        const file = await pickNativeFile(['json']);
        if (file === undefined) projectInput.current?.click();
        else if (file) await onProjectFile(file);
      }
      if (a === 'save') {
        const saved = await saveFile(
          `${safeName(p.name)}.armstruct.json`,
          JSON.stringify(p, null, 2),
          'application/json',
          'json',
        );
        if (saved)
          notify('Projeto salvo com armaduras, rebatimentos e máscaras.');
      }
      if (a === 'delete') {
        if (
          !commit((current) => {
            const commands: RebarCommand[] = current.bars
              .filter((b) => selected.includes(b.id))
              .map((b) => ({
                type: 'bar.delete',
                id: b.id,
                references: 'remove',
              }));
            const next = commands.length
              ? applyRebarBatch(
                  current,
                  executeRebarBatch(current, commands, {
                    units: 'mm',
                    scopeDetailId: isolationRef.current,
                    layerContext: documentKey,
                  }),
                )
              : current;
            return {
              ...next,
              details: next.details.filter((d) => !selected.includes(d.id)),
              masks: next.masks.filter((m) => !selected.includes(m.id)),
              annotations: next.annotations.filter(
                (n) => !selected.includes(n.id),
              ),
              polylines: next.polylines.filter((l) => !selected.includes(l.id)),
            };
          })
        )
          return;
        select([]);
      }
      if (a === 'fit') {
        if (page === 'drawing') canvas()?.fit();
        else {
          setPage('drawing');
          requestAnimationFrame(() => canvas()?.fit());
        }
      }
      if (a === 'grid') setGrid(!grid);
      if (a === 'snap') setSnap(!snap);
      if (a === 'ortho') setOrtho(!ortho);
      if (a === 'dimensions') setDimensions(!dimensions);
      if (a === 'schedule') {
        setScheduleRequest(null);
        setPage('schedule');
      }
      if (a === 'help') setModal('help');
      if (['dxf', 'csv'].includes(a)) {
        const { toCsv, toDxf } = await import('./lib/exports');
        const data = a === 'dxf' ? toDxf(p) : toCsv(p);
        const saved = await saveFile(
          `${safeName(p.name)}.${a}`,
          data,
          a === 'csv' ? 'text/csv' : 'application/dxf',
          a,
        );
        if (saved) notify(`Exportação ${a.toUpperCase()} concluída.`);
      }
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : 'Não foi possível concluir a operação.',
      );
    }
  };
  const onProjectFile = async (file: File) => {
    try {
      const next = await readProjectFile(file);
      if (!commit(() => next)) return;
      select([]);
      setTool('select');
      setTimeout(() => canvas()?.fit(), 50);
      notify('Projeto aberto.');
    } catch (e) {
      notify(
        `Projeto não aberto: ${e instanceof Error ? e.message : 'arquivo inválido'}`,
      );
    }
  };
  const runCommand = (raw: string) => {
    const value = raw.trim();
    setCommand('');
    if (
      maskCalibration?.points.length === 2 &&
      !['U', 'REDO', 'F', 'ZOOM', 'MASCARAS', 'IMPORTAR', 'V', 'H'].includes(
        value.toUpperCase(),
      )
    ) {
      applyCalibration(value || maskCalibration.input);
      return;
    }
    if (
      vertexRequest?.mode === 'lengthen' &&
      /^(?:FINAL\s+)?[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:mm|cm|m)?$/i.test(value)
    ) {
      const s = vertexRequest;
      const final = /^FINAL\s+/i.test(value);
      const length = value.replace(/^FINAL\s+/i, '');
      try {
        parseLength(length);
        const d =
          s.dimensions ??
          initialDimensions(s.project.bars.find((b) => b.id === s.id)!, true);
        setVertexRequest({
          ...s,
          dimensions: {
            ...d,
            length,
            picking: false,
            extensionInput: final
              ? 'final'
              : length.startsWith('+')
                ? 'increment'
                : d.extensionInput,
          },
          cursor: undefined,
          issue: undefined,
        });
      } catch (e) {
        setVertexRequest({ ...s, issue: (e as Error).message });
      }
      return;
    }
    if (
      transformRequest?.kind === 'rotate' &&
      transformRequest.mode === 'angle' &&
      transformRequest.base &&
      /^[-+]?\d+(?:\.\d+)?$/.test(value)
    ) {
      setTransformRequest({
        ...transformRequest,
        angle: Number(value.replace(',', '.')),
        mode: 'angle',
      });
      return;
    }
    const aliases: Record<string, Action> = {
      B: 'bar',
      BARRA: 'bar',
      L: 'bar',
      MASCARAS: 'mask-control',
      CALIBRARMASCARA: 'mask-calibrate',
      MATCHPROP: 'match-properties',
      COPIARPROPRIEDADES: 'match-properties',
      OFFSET: 'mask-offset',
      PARALELA: 'mask-offset',
      APAGARMASCARA: 'mask-erase',
      ERASE: 'mask-erase',
      COPIARMASCARA: 'mask-copy',
      MCOPY: 'mask-copy',
      AJUSTAR: 'mask-trim',
      APARAR: 'mask-trim',
      TRIM: 'mask-trim',
      EXTEND: 'mask-extend',
      ESTENDERMASCARA: 'mask-extend',
      LINHA: 'mask-line',
      RETANGULO: 'mask-rectangle',
      CIRCULO: 'mask-circle',
      MPL: 'mask-polyline',
      PL: 'polyline',
      POLILINHA: 'polyline',
      CONVERTER: 'convert',
      REPETIR: 'repeat',
      FAIXA: 'range',
      COTA: 'dimension-orthogonal',
      ALINHADA: 'dimension-aligned',
      CHAMADA: 'leader',
      CORTE: 'section',
      ARCO: 'section-arc',
      DIVIDIR: 'split',
      EMENDAR: 'join',
      RA: 'refresh-schedule',
      BLOQUEARRA: 'lock-schedule',
      E: 'stirrup',
      ESTRIBO: 'stirrup',
      V: 'select',
      H: 'pan',
      M: 'move',
      MOVE: 'move',
      C: 'copy',
      COPY: 'copy',
      LAYERS: 'layers',
      OCULTAR: 'hide-objects',
      ISOLAR: 'isolate-objects',
      EXIBIRTODOS: 'show-all-objects',
      MOSTRAROCULTOS: 'show-hidden-objects',
      SAIRISOLAMENTO: 'end-object-isolation',
      PLOT: 'plot',
      PLOTAGEM: 'plot',
      NIVEIS: 'layers',
      ALINHAR: 'align-selection',
      INSERIRVERTICE: 'insert-vertex',
      CONTINUAR: 'extend-vertex',
      ESTENDER: 'lengthen-bar',
      ESTENDERBARRA: 'lengthen-bar',
      SEGMENTOS: 'edit-segment',
      REMOVERVERTICE: 'remove-vertex',
      ROTACIONAR: 'rotate',
      GIRAR: 'rotate',
      ESPELHAR: 'mirror',
      DUPLICAR: 'clone-armature',
      CLONAR: 'clone-armature',
      DUPLICARARMADURA: 'clone-armature',
      R: 'detail',
      REBAT: 'detail',
      D: 'distribute',
      DIST: 'measure',
      MEDIR: 'measure',
      F: 'fit',
      ZOOM: 'fit',
      U: 'undo',
      REDO: 'redo',
      DEL: 'delete',
      Q: 'schedule',
      FORMA: 'follow',
      IMPORTAR: 'import',
      AGRUPAR: 'group',
      DESAGRUPAR: 'ungroup',
      EDITARDETALHE: 'edit-detail',
      CONCLUIR: 'finish-detail',
    };
    if (aliases[value.toUpperCase()]) {
      action(aliases[value.toUpperCase()]);
      cmdInput.current?.blur();
      return;
    }
    const polar = value.match(/^@([+-]?\d+(?:\.\d+)?)<([+-]?\d+(?:\.\d+)?)$/);
    if (polar) {
      const p = add(
        vertexRequest
          ? (vertexPreview.anchor ?? { x: 0, y: 0 })
          : (maskOffset?.points.at(-1) ??
              maskManip?.base ??
              maskCalibration?.points.at(-1) ??
              draft.at(-1) ?? { x: 0, y: 0 }),
        rotate({ x: Number(polar[1]), y: 0 }, Number(polar[2])),
      );
      onPoint(p);
      return;
    }
    const xy = value.match(
      /^(@)?\s*([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)$/,
    );
    if (xy) {
      const base = xy[1]
        ? ((vertexRequest
            ? vertexPreview.anchor
            : (maskOffset?.points.at(-1) ??
              maskManip?.base ??
              maskCalibration?.points.at(-1) ??
              draft.at(-1))) ?? {
            x: 0,
            y: 0,
          })
        : { x: 0, y: 0 };
      onPoint(add(base, { x: Number(xy[2]), y: Number(xy[3]) }));
      return;
    }
    if (!value) {
      finish();
      return;
    }
    notify(
      'Comando desconhecido. Use B, E, PL, COTA, CHAMADA, F, DIST ou consulte o Guia de uso.',
    );
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modal === 'new') {
        if (e.key === 'Escape') setModal(null);
        if (
          (e.ctrlKey || e.metaKey) &&
          ['s', 'o'].includes(e.key.toLowerCase())
        )
          e.preventDefault();
        return;
      }
      if (
        detailTransfer ||
        cadInterpretation ||
        repetitionDetailId ||
        fabricationOpen ||
        numberingOpen
      ) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setDetailTransfer(null);
          detailRequest.current = null;
          setCadInterpretation(null);
          setRepetitionDetailId(undefined);
          setFabricationOpen(false);
          setNumberingOpen(false);
        } else if (
          (e.ctrlKey || e.metaKey) &&
          ['s', 'o', 'z', 'y'].includes(e.key.toLowerCase())
        )
          e.preventDefault();
        return;
      }

      const typing = (e.target as HTMLElement)?.closest(
        'input,textarea,select',
      );
      if (e.key === 'Escape') {
        if (match) {
          endMatch();
          cmdInput.current?.blur();
          return;
        }
        if (maskOffset) {
          endMaskOffset();
          cmdInput.current?.blur();
          return;
        }
        if (maskManip) {
          endMaskManip();
          cmdInput.current?.blur();
          return;
        }
        if (maskCad) {
          endMaskCad();
          cmdInput.current?.blur();
          notify(
            'Etapa/prévia descartada. Cortes/prolongamentos já confirmados permanecem; use Desfazer para revertê-los.',
          );
          return;
        }
        if (maskCalibration) {
          setMaskCalibration(null);
          setToolRaw('select');
          cmdInput.current?.blur();
          notify('Ajuste de escala cancelado.');
          return;
        }
        if (vertexRequest || alignmentRequest || scheduleRequest) {
          setScheduleRequest(null);
          setVertexRequest(null);
          setAlignmentRequest(null);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (transformRequest) {
          setTransformRequest(null);
          return;
        }
        setModal(null);
        setTool('select');
        cmdInput.current?.blur();
        return;
      }
      if (typing) return;
      if (e.key === 'F4') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        setFocus(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'F1') {
        e.preventDefault();
        setRibbonCollapsed((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setFocus((v) => !v);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          action('save');
        }
        if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          action('open');
        }
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          action(e.shiftKey ? 'redo' : 'undo');
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          action('redo');
        }
        return;
      }
      if (modal) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        finish();
        return;
      }
      if (e.key === 'Delete') {
        action('delete');
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setSnap((v) => !v);
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setOrtho((v) => !v);
      }
      const a: Record<string, Action> = {
        b: 'bar',
        e: 'stirrup',
        v: 'select',
        h: 'pan',
        f: 'fit',
        m: 'move',
        c: 'copy',
        r: 'detail',
        d: 'distribute',
      };
      if (a[e.key.toLowerCase()]) action(a[e.key.toLowerCase()]);
      if (e.key === ':') {
        e.preventDefault();
        cmdInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  return (
    <div className={`app-shell ${focus ? 'focus-mode' : ''}`}>
      <input
        ref={maskInput}
        type="file"
        accept=".dxf,.dwg"
        multiple
        hidden
        data-testid="mask-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) startMaskBatch('import', maskFileSources(files));
        }}
      />
      <input
        ref={detailInput}
        type="file"
        hidden
        accept=".json"
        data-testid="detail-transfer-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onDetailFile(file);
        }}
      />
      <input
        ref={projectInput}
        type="file"
        accept=".json"
        hidden
        data-testid="project-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onProjectFile(f);
        }}
      />
      <header className="titlebar">
        <div className="app-brand">
          <img
            className="app-icon"
            src="/brand/armadurastruct-hephaestus.webp"
            alt=""
            width="32"
            height="32"
          />
          <strong>
            Armadura<span>Struct</span>
          </strong>
          <span className="version-badge">{appVersion}</span>
        </div>
        <div className="quick-tools">
          <button
            aria-label="Novo projeto"
            title="Novo projeto"
            onClick={() => action('new')}
          >
            <FilePlus2 size={15} />
          </button>
          <button
            aria-label="Abrir projeto"
            title="Abrir projeto"
            onClick={() => action('open')}
          >
            <FolderOpen size={15} />
          </button>
          <button
            aria-label="Salvar projeto"
            title="Salvar projeto · Ctrl+S"
            onClick={() => action('save')}
          >
            <Save size={15} />
          </button>
          <i />
          <button
            aria-label="Desfazer"
            title="Desfazer · Ctrl+Z"
            disabled={!canUndo}
            onClick={() => action('undo')}
          >
            <Undo2 size={15} />
          </button>
          <button
            aria-label="Refazer"
            title="Refazer · Ctrl+Y"
            disabled={!canRedo}
            onClick={() => action('redo')}
          >
            <Redo2 size={15} />
          </button>
        </div>
        <span className="window-project">{p.name}</span>
        <div className="titlebar-right">
          <span className="openstruct-wordmark">OPENSTRUCT</span>
          <i />
          <button
            aria-label="Alternar fundo do desenho"
            title="Alternar fundo do desenho"
            onClick={() => {
              setLight(!light);
              localStorage.setItem(
                'armadurastruct.canvas',
                !light ? 'light' : 'dark',
              );
            }}
          >
            {light ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            aria-label="Guia de uso"
            title="Guia de uso"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={16} />
          </button>
        </div>
      </header>
      <Ribbon
        tab={tab}
        setTab={setTab}
        onAction={action}
        active={{
          [tool]: true,
          grid,
          snap,
          ortho,
          dimensions,
          'mask-offset': !!maskOffset,
          'mask-copy': maskManip?.mode === 'copy',
          'mask-erase': maskManip?.mode === 'erase',
          'mask-trim': maskCad?.mode === 'trim',
          'mask-extend': maskCad?.mode === 'extend',
          'mask-calibrate': !!maskCalibration,
          'lock-schedule': !!p.scheduleLock,
          sidebar: sidebarOpen,
          focus,
        }}
        selected={selected.length}
        canUndo={canUndo}
        canRedo={canRedo}
        isolated={!!isolatedDetailId}
        groupSelected={groupSelection}
        maskDestination={
          <MaskDestination
            onOffset={() => startMaskOffset()}
            onManipulate={(mode) => startMaskManip(mode)}
            onCadEdit={(mode) => startMaskCad(mode)}
            onCalibrate={() => startMaskCalibration()}
            onBatch={(mode) => startMaskBatch(mode)}
            project={p}
            activeId={drawingMaskId}
            context={maskDrawingContext}
            onActivate={activateDrawingMask}
            onCreate={() => {
              setTool('select');
              setNativeEntity(undefined);
              setCreatingMask(true);
              setMaskControl(true);
            }}
          />
        }
        collapsed={ribbonCollapsed || focus}
        setCollapsed={(v) => {
          setRibbonCollapsed(v);
          setFocus(false);
        }}
        settings={{
          diameter: newDiameter,
          quantity: newQuantity,
          spacing: newSpacing,
          cover,
        }}
        onSettings={(patch) => {
          if (patch.diameter !== undefined) setNewDiameter(patch.diameter);
          if (patch.quantity !== undefined) setNewQuantity(patch.quantity);
          if (patch.spacing !== undefined) setNewSpacing(patch.spacing);
          if (patch.cover !== undefined) setCover(patch.cover);
        }}
      />
      {p.id === INITIAL_EXAMPLE_ID && (
        <div className="example-notice">
          <span>
            <strong>Exemplo ArmaduraStruct</strong> · Vigas e pilares · RA
            original de referência; comprimentos das dobras em conferência.
          </span>
          <button onClick={() => setExampleReviewOpen(true)}>
            Conferir exemplo
          </button>
        </div>
      )}
      <div className="workspace">
        <main className="main-workspace">
          <div className="document-tabs">
            <div className="document-strip" aria-label="Documentos abertos">
              <button
                className={
                  documentKey === 'model' && page === 'drawing' ? 'active' : ''
                }
                aria-label="Desenho"
                onClick={() => switchDocument('model')}
              >
                <span className="document-icon">⌗</span> Desenho{' '}
                <span className="tab-dot" />
              </button>
              {[
                ...p.sheets.map((s) => ({
                  key: `sheet:${s.id}`,
                  name: s.name,
                  prefix: '▤',
                  kind: 'folha',
                })),
                ...p.hierarchy.drawings.map((d) => ({
                  key: `drawing:${d.id}`,
                  name: drawingLabel(p, d),
                  prefix: '⌗',
                  kind: 'desenho',
                })),
              ]
                .filter(
                  (d) =>
                    documents.projectId === p.id &&
                    documents.opened.includes(d.key),
                )
                .map((d) => (
                  <div
                    key={d.key}
                    className={`document-tab ${documentKey === d.key && page === 'drawing' ? 'active' : ''}`}
                  >
                    <button
                      title={d.name}
                      aria-label={`Aba ${d.kind} ${d.name}`}
                      onClick={() => switchDocument(d.key)}
                    >
                      {d.prefix} {d.name}
                    </button>
                    <button
                      className="close-document"
                      aria-label={`Fechar aba ${d.name}`}
                      onClick={() => closeDocument(d.key)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
            </div>
            <button
              className={page === 'schedule' ? 'active' : ''}
              onClick={() => setPage('schedule')}
            >
              <Table2 size={14} /> Quadro de aço <em>{p.bars.length}</em>
            </button>
            <div className="document-toolbar">
              {activeSheet && page === 'drawing' && (
                <button
                  onClick={() => action('align-selection')}
                  disabled={
                    p.hierarchy.placements.filter(
                      (v) => v.sheetId === activeSheet.id,
                    ).length < 2
                  }
                >
                  Alinhar vistas…
                </button>
              )}
              <button
                aria-label="Foco no CAD"
                title="Foco no CAD · Ctrl+0"
                onClick={() => setFocus(!focus)}
              >
                <Focus size={14} />
              </button>
              <button
                aria-label="Alternar painel lateral"
                title="Painel lateral · F4"
                onClick={() => {
                  setSidebarOpen(!sidebarOpen);
                  setFocus(false);
                }}
              >
                <PanelRight size={14} />
              </button>
              <button
                onClick={() => action('pdf')}
                title={
                  activeSheet
                    ? 'Exportar esta folha em PDF'
                    : 'Exportar todas as folhas em PDF'
                }
              >
                <ArrowDownToLine size={14} />
                <span>{activeSheet ? 'PDF desta folha' : 'Exportar PDF'}</span>
              </button>
            </div>
          </div>
          {isolatedDetailId && (
            <div
              className="isolation-bar"
              role="region"
              aria-label="Edição isolada"
            >
              <nav aria-label="Caminho de edição">
                <span>Projeto</span>
                <b title={detailPath(p, isolatedDetailId)}>
                  {detailPath(p, isolatedDetailId)}
                </b>
              </nav>
              <span className="isolation-hint">
                Demais detalhamentos protegidos
              </span>
              <button onClick={finishDetailEdit}>Concluir edição</button>
            </div>
          )}
          {page === 'drawing' &&
            (currentVisibility.hiddenIds.length > 0 ||
              currentVisibility.isolation ||
              currentVisibility.showHidden) && (
              <div
                className="context-bar visibility-bar"
                role="region"
                aria-label="Visibilidade do contexto"
              >
                <b>Visibilidade</b>
                <span>
                  {currentVisibility.hiddenIds.length} oculto(s)
                  {currentVisibility.isolation ? ' · Isolamento ativo' : ''}
                  {currentVisibility.showHidden ? ' · Realce laranja' : ''}
                </span>
                <button onClick={() => setVisibilityOpen(true)}>
                  Revisar objetos
                </button>
                {currentVisibility.isolation && (
                  <button
                    onClick={() =>
                      commit((p) => endObjectIsolation(p, visibilityKey))
                    }
                  >
                    Sair do isolamento
                  </button>
                )}
                <button
                  onClick={() =>
                    commit((p) => showAllObjects(p, visibilityKey))
                  }
                >
                  Exibir todos
                </button>
                {currentVisibility.showHidden && (
                  <button
                    onClick={() =>
                      commit((p) =>
                        setVisibility(p, visibilityKey, { showHidden: false }),
                      )
                    }
                  >
                    Encerrar realce
                  </button>
                )}
              </div>
            )}
          {scheduleRequest && activeSheet && (
            <SheetSchedulePanel
              project={p}
              value={scheduleRequest}
              onSheet={(id) => {
                switchDocument(`sheet:${id}`);
                setPageRaw('drawing');
                setScheduleRequest({ ...scheduleRequest, sheetId: id });
              }}
              onChange={(options) =>
                setScheduleRequest({ ...scheduleRequest, options })
              }
              onCancel={() => setScheduleRequest(null)}
            />
          )}
          {alignmentRequest && (
            <AlignmentPanel
              value={alignmentRequest}
              items={alignmentPreview.items}
              onChange={setAlignmentRequest}
              onApply={applyAlignment}
              onCancel={() => setAlignmentRequest(null)}
              error={alignmentPreview.error}
            />
          )}
          {page === 'drawing' && activeSheet ? (
            <SheetCanvas
              key={`${p.id}:${sessionsProject.current === p.id ? 'ready' : 'loading'}:${documentKey}`}
              ref={paperCanvas}
              project={
                alignmentRequest?.sheetId ? (alignmentPreview.project ?? p) : p
              }
              preview={!!alignmentRequest}
              onReferencePoint={alignmentRequest?.picking ? onPoint : undefined}
              sheet={activeSheet}
              initialState={sessions.current.get(documentKey)?.camera}
              selectedView={selectedView}
              selectedSchedule={selectedSchedule}
              schedulePlacement={
                scheduleRequest?.sheetId === activeSheet.id
                  ? scheduleRequest.options
                  : undefined
              }
              onSelectSchedule={() => {
                setSelectedView(undefined);
                setSelectedSchedule(true);
                setSidebarTab('sheets');
              }}
              onMoveSchedule={(origin) => {
                if (activeSheet.steelSchedule)
                  commitLayout((p) =>
                    setSheetSchedule(p, activeSheet.id, {
                      ...activeSheet.steelSchedule!,
                      origin,
                    }),
                  );
              }}
              onPlaceSchedule={(origin) => {
                if (
                  !scheduleRequest ||
                  scheduleRequest.projectId !== p.id ||
                  scheduleRequest.sheetId !== activeSheet.id
                )
                  return;
                try {
                  const value = { ...scheduleRequest.options, origin },
                    table = sheetScheduleGeometry(p, activeSheet.id, value),
                    issues = sheetScheduleIssues(activeSheet, table);
                  if (issues.length) {
                    notify(issues.map((i) => i.message).join(' '));
                    return;
                  }
                  if (
                    commitLayout((p) =>
                      setSheetSchedule(p, activeSheet.id, value),
                    )
                  ) {
                    setScheduleRequest(null);
                    setSelectedView(undefined);
                    setSelectedSchedule(true);
                    notify(
                      'Quadro de aço inserido e vinculado às armaduras desta prancha.',
                    );
                  }
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
              onCancelSchedule={() => setScheduleRequest(null)}
              pan={tool === 'pan'}
              onSelect={(id) => {
                setSelectedSchedule(false);
                setSelectedView(id);
                setSidebarTab('sheets');
              }}
              onMove={(id, origin) =>
                commitLayout((p) => updatePlacement(p, id, { origin }))
              }
              onOpenDrawing={openDrawing}
            />
          ) : page === 'drawing' ? (
            <>
              {tool === 'follow' && followRequest && (
                <FollowFormPanel
                  edges={followRequest.edges}
                  order={followResult.chain?.order ?? []}
                  mode={followRequest.mode}
                  whole={followRequest.whole}
                  values={followRequest.values}
                  defaultCover={cover}
                  diameter={newDiameter}
                  quantity={newQuantity}
                  side={followResult.side?.label}
                  offset={followResult.preview?.offset}
                  radius={followResult.preview?.radius}
                  length={followResult.preview?.physical.length}
                  adjustments={followResult.chain?.adjustments.length ?? 0}
                  error={followResult.error}
                  onValues={(v) =>
                    setFollowRequest({
                      ...followRequest,
                      values: { ...followRequest.values, ...v },
                    })
                  }
                  onMode={(mode) =>
                    setFollowRequest({ ...followRequest, mode })
                  }
                  onWhole={(whole) =>
                    setFollowRequest({ ...followRequest, whole })
                  }
                  onRemove={(key) =>
                    setFollowRequest({
                      ...followRequest,
                      sidePoint: undefined,
                      flip: false,
                      mode: 'edges',
                      edges: followRequest.edges.filter((e) => e.key !== key),
                    })
                  }
                  onClear={() =>
                    setFollowRequest({
                      ...followRequest,
                      edges: [],
                      sidePoint: undefined,
                      flip: false,
                      mode: 'edges',
                    })
                  }
                  onFlip={() =>
                    setFollowRequest({
                      ...followRequest,
                      flip: !followRequest.flip,
                    })
                  }
                  onDefault={() =>
                    setFollowRequest({
                      ...followRequest,
                      values: { ...followRequest.values, cover: String(cover) },
                    })
                  }
                  onCancel={() => setTool('select')}
                />
              )}
              {nativeKind && (
                <div className="context-bar">
                  <b>Máscara: {nativeTarget?.name}</b>
                  <span>
                    {
                      {
                        line: 'Linha',
                        rectangle: 'Retângulo',
                        circle: 'Círculo',
                        polyline: 'Polilinha',
                      }[nativeKind]
                    }{' '}
                    · {draft.length ? 'Próximo ponto' : 'Primeiro ponto'} · mm
                  </span>
                  {nativeKind === 'polyline' && (
                    <button onClick={() => putNative(draft, true)}>
                      Fechar polilinha
                    </button>
                  )}
                  <button onClick={() => setTool('select')}>
                    Cancelar desenho da máscara
                  </button>
                </div>
              )}
              <CadCanvas
                followInteraction={
                  tool === 'follow' && followRequest
                    ? {
                        mode: followRequest.mode,
                        available: availableFollowEdges,
                        selected: followRequest.edges,
                        chain: followResult.chain,
                        preview: followResult.preview,
                        sidePoint: followRequest.sidePoint,
                      }
                    : undefined
                }
                maskSidePick={maskOffset?.stage === 'side'}
                maskEditing={
                  match && match.stage !== 'properties'
                    ? {
                        entities: maskCadEntities(p, maskDrawingContext),
                        targetMaskId: drawingMaskId,
                        stage: 'targets',
                      }
                    : maskOffset?.stage === 'entity'
                      ? {
                          entities: offsetEntities,
                          targetMaskId: maskOffset.maskId,
                          stage: 'targets',
                        }
                      : maskManip?.stage === 'selection'
                        ? {
                            entities: manipEntities,
                            targetMaskId: maskManip.maskId,
                            stage: 'targets',
                          }
                        : maskCad
                          ? {
                              entities: cadMaskEntities,
                              targetMaskId: maskCad.maskId,
                              all: maskCad.all,
                              stage: maskCad.stage,
                              selectedTarget: maskCad.selectedTarget,
                            }
                          : undefined
                }
                onMaskEntityPick={
                  match
                    ? (ref) => {
                        if (ref) pickMatch(ref.key);
                      }
                    : maskOffset
                      ? (ref, at, tolerance) => offsetPoint(at, ref, tolerance)
                      : maskManip
                        ? (ref) => toggleManipEntity(ref)
                        : pickMaskCad
                }
                onMaskEntityHover={(ref, at, tolerance) =>
                  maskOffset?.stage === 'side'
                    ? setMaskOffset((s) =>
                        s
                          ? {
                              ...s,
                              cursor: at,
                              pickTolerance: tolerance,
                              issue: undefined,
                            }
                          : s,
                      )
                    : setMaskCad((s) =>
                        s
                          ? {
                              ...s,
                              hover: ref ? { ref, at } : undefined,
                              issue: undefined,
                            }
                          : s,
                      )
                }
                maskCadOverlay={offsetOverlay ?? manipOverlay ?? maskCadOverlay}
                highlightedMaskId={
                  maskOffset?.maskId ??
                  maskManip?.maskId ??
                  maskCad?.maskId ??
                  maskCalibration?.mask.id
                }
                onFollowEdge={pickFollowEdge}
                nativeDrawing={!!nativeKind}
                onNativePick={(maskId, entityId) => {
                  if (p.hierarchy.objectDetails[maskId] !== activeDetailId) {
                    notify(
                      'Ative o detalhamento desta máscara na aba Projeto antes de editar suas entidades.',
                    );
                    return;
                  }
                  setSelectedRaw([]);
                  setMaskId(maskId);
                  setNativeEntity(entityId);
                  setTool('select');
                  setMaskControl(true);
                }}
                previewLines={
                  offsetLines ??
                  manipLines ??
                  calibrationLines ??
                  nativePreview ??
                  (vertexRequest
                    ? vertexPreview.lines
                    : alignmentRequest
                      ? alignmentPreview.lines
                      : transformPreview.lines)
                }
                extraSnapPoints={
                  vertexRequest &&
                  canCaptureObject(p, documentKey, vertexRequest.id)
                    ? vertexPreview.points
                    : undefined
                }
                previewBase={
                  vertexRequest?.mode === 'lengthen' &&
                  vertexPreview.previewBar &&
                  !vertexPreview.error
                    ? world(
                        vertexPreview.previewBar.points[
                          vertexRequest.end === 'start'
                            ? 0
                            : vertexPreview.previewBar.points.length - 1
                        ],
                        vertexPreview.previewBar,
                      )
                    : (maskOffset?.points.at(-1) ??
                      maskManip?.base ??
                      maskCalibration?.points[0] ??
                      transformRequest?.base)
                }
                commandActive={
                  !!match ||
                  !!maskOffset ||
                  !!maskManip ||
                  !!maskCad ||
                  !!maskCalibration ||
                  !!transformRequest ||
                  !!vertexRequest ||
                  !!alignmentRequest
                }
                onContextRequest={(ids, point, screen) => {
                  setContextMenu({ ids, point, screen });
                  if (ids.length === 1 && p.masks.some((m) => m.id === ids[0]))
                    setMaskId(ids[0]);
                }}
                layerContext={documentKey}
                key={`${p.id}:${sessionsProject.current === p.id ? 'ready' : 'loading'}:${documentKey}`}
                initialState={sessions.current.get(documentKey)?.camera}
                ref={cad}
                project={matchPreview.plan?.project ?? p}
                isolatedDetailId={isolatedDetailId}
                onEditDetail={beginDetailEdit}
                tool={
                  match ||
                  maskOffset ||
                  maskManip ||
                  maskCad ||
                  maskCalibration ||
                  transformRequest ||
                  vertexRequest ||
                  alignmentRequest
                    ? 'measure'
                    : tool
                }
                selected={selected}
                setSelected={select}
                onPoint={onPoint}
                onPrimitive={follow}
                onFinish={finish}
                onBarChange={editBar}
                draft={
                  maskOffset?.stage === 'measure'
                    ? maskOffset.points
                    : maskManip?.base
                      ? [maskManip.base]
                      : maskCalibration
                        ? maskCalibration.points.length === 1
                          ? maskCalibration.points
                          : []
                        : vertexRequest && vertexPreview.anchor
                          ? [vertexPreview.anchor]
                          : draft
                }
                grid={grid}
                snap={snap}
                ortho={ortho && vertexRequest?.mode !== 'lengthen'}
                light={light}
                setTool={setTool}
                onCursor={(point) => {
                  onCursor(point);
                  if (maskManip?.stage === 'target')
                    setMaskManip((s) =>
                      s ? { ...s, cursor: point, issue: undefined } : s,
                    );
                  if (nativeKind) setNativeCursor(point);
                  if (
                    vertexRequest &&
                    (!dimensionalMode(vertexRequest.mode) ||
                      vertexRequest.dimensions?.picking)
                  )
                    setVertexRequest((s) =>
                      s ? { ...s, cursor: point, issue: undefined } : s,
                    );
                  if (transformRequest)
                    setTransformRequest((s) =>
                      s && ['axis', 'target'].includes(s.stage)
                        ? { ...s, cursor: point }
                        : s,
                    );
                }}
                showDimensions={dimensions}
              />
              {match && (
                <MatchPropertiesPanel
                  session={match}
                  entities={matchEntities}
                  plan={matchPreview.plan}
                  error={matchPreview.error}
                  onChange={(value) => {
                    matchConsumed.current = false;
                    setMatch({ ...match, ...value });
                  }}
                  onApply={applyMatch}
                  onEnd={endMatch}
                />
              )}
              {maskOffset && (
                <MaskOffsetPanel
                  session={maskOffset}
                  entities={offsetEntities}
                  preview={offsetPreview}
                  onInput={(input) =>
                    setMaskOffset((v) =>
                      v ? { ...v, input, issue: undefined } : v,
                    )
                  }
                  onDistance={confirmOffsetDistance}
                  onMeasure={() =>
                    setMaskOffset((v) =>
                      v
                        ? {
                            ...v,
                            stage: 'measure',
                            points: [],
                            issue: undefined,
                          }
                        : v,
                    )
                  }
                  onTarget={pickOffsetTarget}
                  onRestart={() =>
                    setMaskOffset((v) =>
                      v
                        ? {
                            ...v,
                            stage: 'distance',
                            target: undefined,
                            cursor: undefined,
                            points: [],
                            issue: undefined,
                          }
                        : v,
                    )
                  }
                  onEnd={endMaskOffset}
                />
              )}
              {maskManip && (
                <MaskManipPanel
                  session={maskManip}
                  entities={manipEntities}
                  onToggle={toggleManipEntity}
                  onConfirm={finishManip}
                  onCancel={endMaskManip}
                  error={manipPreview.error}
                />
              )}
              {maskCad && (
                <MaskCadPanel
                  session={maskCad}
                  entities={cadMaskEntities}
                  preview={maskCadPreview}
                  onToggle={toggleMaskCadLimit}
                  onStage={confirmMaskCadLimits}
                  onRestart={() =>
                    setMaskCad((s) =>
                      s
                        ? {
                            ...s,
                            stage: 'limits',
                            all: false,
                            hover: undefined,
                            issue: undefined,
                          }
                        : s,
                    )
                  }
                  onTarget={(key) =>
                    setMaskCad((s) =>
                      s
                        ? {
                            ...s,
                            selectedTarget: key || undefined,
                            hover: undefined,
                            issue: undefined,
                          }
                        : s,
                    )
                  }
                  onEnd={endMaskCad}
                />
              )}
              {maskCalibration && (
                <MaskCalibrationPanel
                  value={maskCalibration}
                  preview={calibrationPreview}
                  onInput={(input) =>
                    setMaskCalibration((s) =>
                      s ? { ...s, input, issue: undefined } : s,
                    )
                  }
                  onApply={() => applyCalibration()}
                  onCancel={() => {
                    setMaskCalibration(null);
                    setToolRaw('select');
                  }}
                  onRepick={() =>
                    setMaskCalibration((s) =>
                      s ? { ...s, points: [], input: '', issue: undefined } : s,
                    )
                  }
                />
              )}
              {vertexRequest && (
                <VertexPanel
                  value={vertexRequest}
                  onChange={setVertexRequest}
                  count={vertexPreview.points.length}
                  onApply={applyVertex}
                  onCancel={() => setVertexRequest(null)}
                  error={vertexPreview.error}
                  warnings={vertexPreview.warnings}
                  previewBar={vertexPreview.previewBar}
                  canApply={vertexPreview.canApply}
                />
              )}
              {transformRequest && (
                <TransformPanel
                  value={transformRequest}
                  onChange={setTransformRequest}
                  onApply={applyTransform}
                  onCancel={() => setTransformRequest(null)}
                  error={transformPreview.error}
                  shared={transformPreview.shared}
                />
              )}
              <div className="command-panel">
                <div className="command-history">
                  <ChevronRight size={12} />
                  <span>
                    {draft.length
                      ? `${draft.length} ponto(s) · ${prompts[tool]}`
                      : message}
                  </span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runCommand(command);
                  }}
                >
                  <Terminal size={15} />
                  <label htmlFor="command-input">Comando</label>
                  <input
                    ref={cmdInput}
                    id="command-input"
                    aria-label="Comando CAD"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Digite um comando ou coordenadas X,Y"
                    autoComplete="off"
                  />
                  <kbd>↵</kbd>
                </form>
              </div>
            </>
          ) : (
            <>
              <div
                className={`schedule-control ${scheduleChanged(p) ? 'stale' : ''}`}
              >
                <span>
                  {p.scheduleLock
                    ? scheduleChanged(p)
                      ? 'RA bloqueada · há alterações pendentes'
                      : 'RA bloqueada · valores conferidos'
                    : 'RA automática · vinculada ao desenho'}
                </span>
                <button onClick={() => action('refresh-schedule')}>
                  <RefreshCw size={14} />
                  Atualizar RA
                </button>
                <button onClick={() => action('lock-schedule')}>
                  <LockKeyhole size={14} />
                  {p.scheduleLock ? 'Desbloquear RA' : 'Bloquear RA'}
                </button>
              </div>
              <Schedule project={p} onSelect={(id) => select([id])} />
            </>
          )}
        </main>
        {sidebarOpen && !focus && (
          <aside className="sidebar-dock" aria-label="Painel lateral">
            <div
              className="sidebar-tabs"
              role="tablist"
              aria-label="Painel lateral"
            >
              <button
                role="tab"
                aria-selected={sidebarTab === 'project'}
                onClick={() => setSidebarTab('project')}
              >
                Projeto
              </button>
              <button
                role="tab"
                aria-selected={sidebarTab === 'properties'}
                onClick={() => setSidebarTab('properties')}
              >
                Propriedades
              </button>
              <button
                role="tab"
                aria-selected={sidebarTab === 'sheets'}
                onClick={() => setSidebarTab('sheets')}
              >
                Pranchas
              </button>
              <button
                className="dock-close"
                aria-label="Recolher painel lateral"
                title="Recolher painel · F4"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            {sidebarTab === 'sheets' ||
            (activeSheet && sidebarTab === 'properties') ? (
              <SheetManager
                key={`${p.id}:${activeSheet?.id ?? 'model'}`}
                project={p}
                sheetId={activeSheet?.id}
                selectedView={selectedView}
                onInsertSchedule={() => action('insert-sheet-schedule')}
                onSelectView={(id) => {
                  setSelectedSchedule(false);
                  setSelectedView(id);
                }}
                onChange={commitLayout}
                onExportAll={() => exportPaper()}
                onOpenSheet={(id) => {
                  switchDocument(`sheet:${id}`);
                  setSidebarTab('sheets');
                }}
                onOpenDrawing={openDrawing}
                locked={!!isolatedDetailId}
              />
            ) : sidebarTab === 'project' ? (
              <ProjectTree
                key={p.id}
                project={p}
                activeDetailId={activeDetailId}
                isolatedDetailId={isolatedDetailId}
                onEditDetail={beginDetailEdit}
                onOpenDrawing={openDrawing}
                onOrganizeHierarchy={() => {
                  switchDocument('model');
                  isolationRef.current = undefined;
                  setIsolation(null);
                  setSidebarTab('project');
                }}
                onSelectDetail={(id) => select(detailObjectIds(p, id))}
                onActiveDetail={activateDetail}
                onHierarchy={(next) => commit(() => next)}
                selected={selected}
                maskId={maskId}
                onSelect={select}
                onMask={(id) => {
                  select([]);
                  setMaskId(id);
                  const owner = p.hierarchy.objectDetails[id];
                  if (owner) activateDetail(owner);
                  setSidebarTab('properties');
                }}
                onToggleMask={(id) =>
                  commit((p) => ({
                    ...p,
                    masks: p.masks.map((m) =>
                      m.id === id ? { ...m, visible: !m.visible } : m,
                    ),
                  }))
                }
                onRemoveMask={(id) => {
                  commit((p) => ({
                    ...p,
                    masks: p.masks.filter((m) => m.id !== id),
                  }));
                  if (id === maskId) setMaskId(null);
                }}
                onImport={() => action('import')}
                onDemo={() => {
                  setBusy('Carregando Exemplo ArmaduraStruct…');
                  void initialExampleProject()
                    .then((project) => {
                      commit(() => project);
                      select([]);
                      setTool('select');
                      setDocuments({
                        projectId: project.id,
                        active: `sheet:${INITIAL_EXAMPLE_SHEETS[0]}`,
                        opened: INITIAL_EXAMPLE_SHEETS.map(
                          (id) => `sheet:${id}`,
                        ),
                      });
                      setSidebarTab('sheets');
                    })
                    .catch((e) => notify(String(e)))
                    .finally(() => setBusy(''));
                }}
              />
            ) : selected.length === 1 &&
              p.details.some((d) => d.id === selected[0]) ? (
              <RepresentationInspector
                project={p}
                representation={p.details.find((d) => d.id === selected[0])!}
                onEditBar={() => {
                  const r = p.details.find((d) => d.id === selected[0])!;
                  const owner = p.hierarchy.objectDetails[r.barId];
                  const drawing = p.hierarchy.drawings.find(
                    (d) => d.detailId === owner,
                  );
                  if (drawing) {
                    openDrawing(drawing.id);
                    select([r.barId]);
                  }
                }}
                onChange={(patch) =>
                  commitRebars([
                    {
                      type: 'representation.update',
                      id: selected[0],
                      ...patch,
                    },
                  ])
                }
                onDelete={() => {
                  if (
                    commitRebars([
                      { type: 'representation.delete', id: selected[0] },
                    ])
                  )
                    select([]);
                }}
              />
            ) : groupSelection ? (
              <div className="inspector detail-inspector">
                <div className="panel-heading">
                  <Shapes size={15} />
                  <b>Detalhamento selecionado</b>
                </div>
                <div className="panel-scroll">
                  <h3>
                    {selectedGroup?.name ||
                      `${selectedGroups.length} detalhamentos`}
                  </h3>
                  {selectedGroup && (
                    <p className="field-help">
                      {detailPath(p, selectedGroup.id)}
                    </p>
                  )}
                  <p>{selected.length} objetos selecionados como conjunto.</p>
                  <p className="field-help">
                    Abra a edição isolada para alterar as peças, cotas e
                    chamadas.
                  </p>
                  {selectedGroup && (
                    <button
                      className="primary detail-edit-action"
                      onClick={() => beginDetailEdit(selectedGroup.id)}
                    >
                      Editar detalhamento isoladamente
                    </button>
                  )}
                  <button
                    className="detail-edit-action"
                    onClick={() => action('ungroup')}
                  >
                    Desagrupar seleção
                  </button>
                  <p className="field-help">
                    Desagrupar mantém as armaduras, os vínculos e o levantamento
                    de aço.
                  </p>
                </div>
              </div>
            ) : annotation || polyline ? (
              <DraftInspector
                onVertexEdit={(mode) =>
                  action(
                    mode === 'insert'
                      ? 'insert-vertex'
                      : mode === 'extend'
                        ? 'extend-vertex'
                        : 'remove-vertex',
                  )
                }
                annotation={annotation}
                polyline={polyline}
                project={p}
                onLinks={(barIds) => {
                  const object = annotation ?? polyline!;
                  commitRebars([
                    { type: 'armature.bind', objectIds: [object.id], barIds },
                  ]);
                }}
                onAnnotation={(patch) =>
                  commit((p) => ({
                    ...p,
                    annotations: p.annotations.map((n) =>
                      n.id === annotation?.id ? { ...n, ...patch } : n,
                    ),
                  }))
                }
                onPolyline={(patch) =>
                  commit((p) => ({
                    ...p,
                    polylines: p.polylines.map((n) =>
                      n.id === polyline?.id ? { ...n, ...patch } : n,
                    ),
                  }))
                }
              />
            ) : isolatedDetailId && !chosen && !mask ? (
              <div className="inspector">
                <div className="panel-heading">
                  <Shapes size={15} />
                  <b>Edição do detalhamento</b>
                </div>
                <p className="isolation-empty">
                  Selecione um objeto deste detalhamento para editar suas
                  propriedades. Use Concluir edição para voltar ao projeto.
                </p>
              </div>
            ) : (
              <Inspector
                onDimensionEdit={(mode) =>
                  action(mode === 'segment' ? 'edit-segment' : 'lengthen-bar')
                }
                onVertexEdit={(mode) =>
                  action(
                    mode === 'insert'
                      ? 'insert-vertex'
                      : mode === 'extend'
                        ? 'extend-vertex'
                        : 'remove-vertex',
                  )
                }
                project={p}
                bar={chosen}
                mask={mask}
                onBar={(patch) => chosen && editBar(chosen.id, patch)}
                onDistributionSpacing={(spacing) =>
                  chosen?.distribution &&
                  commitRebars([
                    {
                      type: 'distribution.set',
                      barId: chosen.id,
                      distribution: chosen.distribution,
                      count: { mode: 'spacing', spacing },
                    },
                  ])
                }
                onMask={(patch) =>
                  commit((p) => ({
                    ...p,
                    masks: p.masks.map((m) =>
                      m.id === maskId ? { ...m, ...patch } : m,
                    ),
                  }))
                }
                onProject={(patch) =>
                  commit((current) => {
                    if (!patch.details) return { ...current, ...patch };
                    const commands: RebarCommand[] = patch.details
                      .filter(
                        (d) =>
                          JSON.stringify(d) !==
                          JSON.stringify(
                            current.details.find((old) => old.id === d.id),
                          ),
                      )
                      .map((d) => ({
                        type: 'representation.update',
                        id: d.id,
                        barId: d.barId,
                        origin: d.origin,
                        rotation: d.rotation,
                        scale: d.scale,
                        identification: d.identification,
                      }));
                    return commands.length
                      ? applyRebarBatch(
                          current,
                          executeRebarBatch(current, commands, {
                            units: 'mm',
                            scopeDetailId: isolationRef.current,
                            layerContext: documentKey,
                          }),
                        )
                      : current;
                  })
                }
                onSelectRepresentation={(id) => select([id])}
                onRemoveDetails={() =>
                  commitRebars(
                    p.details
                      .filter((d) => d.barId === chosen?.id)
                      .map((d) => ({
                        type: 'representation.delete',
                        id: d.id,
                      })),
                  )
                }
              />
            )}
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <span
          className="active-detail-path"
          title={detailPath(p, activeDetailId)}
        >
          {detailPath(p, activeDetailId)}
        </span>
        <span
          className={`save-status ${saveState.startsWith('Falha') ? 'warning-text' : ''}`}
        >
          <Check size={12} />
          {saveState}
        </span>
        <span className="cursor-position" ref={cursorReadout}>
          X 0,0 · Y 0,0 · mm
        </span>
        <div className="status-toggles">
          <button
            className={grid ? 'active' : ''}
            onClick={() => setGrid(!grid)}
          >
            GRADE
          </button>
          <button
            className={snap ? 'active' : ''}
            onClick={() => setSnap(!snap)}
          >
            ENCAIXES <kbd>F3</kbd>
          </button>
          <button
            className={ortho ? 'active' : ''}
            onClick={() => setOrtho(!ortho)}
          >
            ORTO <kbd>F8</kbd>
          </button>
          <button
            className={dimensions ? 'active' : ''}
            onClick={() => setDimensions(!dimensions)}
          >
            COTAS
          </button>
        </div>
        <span className="version-footer">OpenStruct · {appVersion}</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {(!ready || busy) && (
        <div className="busy-overlay">
          <LoaderCircle className="spin" size={28} />
          <b>{busy || 'Abrindo projeto…'}</b>
          <span>Processamento local</span>
        </div>
      )}
      {exampleReviewOpen && p.id === INITIAL_EXAMPLE_ID && (
        <Suspense
          fallback={<div className="busy-overlay">Preparando conferência…</div>}
        >
          <ExampleReviewDialog
            project={p}
            onClose={() => setExampleReviewOpen(false)}
          />
        </Suspense>
      )}
      {detailTransfer && (
        <Suspense
          fallback={<div className="busy-overlay">Preparando comparação…</div>}
        >
          <DetailTransferDialog
            project={p}
            source={detailTransfer.source}
            fileName={detailTransfer.fileName}
            mode={detailTransfer.mode}
            elementId={
              p.hierarchy.details.find((d) => d.id === activeDetailId)!
                .elementId
            }
            activeDetailId={activeDetailId}
            sourceDetailId={detailTransfer.sourceDetailId}
            sheetId={activeSheet?.id}
            onApply={acceptDetailTransfer}
            onClose={() => {
              setDetailTransfer(null);
              detailRequest.current = null;
            }}
          />
        </Suspense>
      )}
      {cadInterpretation && (
        <Suspense
          fallback={
            <div className="busy-overlay">Preparando interpretação…</div>
          }
        >
          <CadInterpretDialog
            project={p}
            detailId={cadInterpretation.detailId}
            maskId={cadInterpretation.maskId}
            onClose={() => setCadInterpretation(null)}
            onApply={(plan: CadInterpretation) => {
              if (
                p.id !== cadInterpretation.projectId ||
                (isolationRef.current &&
                  isolationRef.current !== cadInterpretation.detailId)
              ) {
                notify('O contexto mudou. Abra novamente a interpretação.');
                return false;
              }
              if (!commit((current) => applyCadInterpretation(current, plan)))
                return false;
              setCadInterpretation(null);
              setDraft([]);
              setToolRaw('select');
              setMaskId(null);
              setContext({
                projectId: p.id,
                detailId: cadInterpretation.detailId,
              });
              setSelectedRaw(plan.bar ? [plan.bar.id] : []);
              setSidebarTab('properties');
              setSidebarOpen(true);
              notify(
                'Posição física criada por atribuição explícita. A máscara foi preservada como referência.',
              );
              return true;
            }}
          />
        </Suspense>
      )}
      {numberingOpen && (
        <Suspense
          fallback={<div className="busy-overlay">Preparando numeração…</div>}
        >
          <NumberingDialog
            project={p}
            detailId={activeDetailId}
            selected={selected}
            onClose={() => setNumberingOpen(false)}
            onApply={(result) => {
              if (!commit((current) => applyRebarBatch(current, result)))
                return false;
              setNumberingOpen(false);
              notify(
                'Posições renumeradas. Geometria, vínculos e quantitativos preservados.',
              );
              return true;
            }}
          />
        </Suspense>
      )}
      {fabricationOpen && (
        <Suspense
          fallback={<div className="busy-overlay">Comparando posições…</div>}
        >
          <FabricationDialog
            project={p}
            onClose={() => setFabricationOpen(false)}
            onApply={(result) => {
              if (isolationRef.current) {
                notify('Conclua a edição isolada.');
                return false;
              }
              if (!commit((current) => applyRebarBatch(current, result)))
                return false;
              setFabricationOpen(false);
              notify(
                'Posições de fabricação atualizadas. Ocorrências, vistas e quantidades preservadas.',
              );
              return true;
            }}
          />
        </Suspense>
      )}
      {repetitionDetailId && (
        <Suspense
          fallback={<div className="busy-overlay">Preparando repetições…</div>}
        >
          <DetailRepetitionDialog
            project={p}
            detailId={repetitionDetailId}
            onClose={() => setRepetitionDetailId(undefined)}
            onApply={(next, id, base) => {
              if (historyRef.current.present !== base || isolationRef.current) {
                notify('O projeto/contexto mudou. Abra novamente a repetição.');
                return false;
              }
              if (!commit(() => next)) return false;
              setRepetitionDetailId(undefined);
              setSelectedRaw([]);
              setMaskId(null);
              setContext({ projectId: next.id, detailId: id });
              notify(
                'Repetição aplicada. Vistas e relação de aço usam uma única definição física.',
              );
              return true;
            }}
          />
        </Suspense>
      )}
      {contextMenu && (
        <CadContextMenu
          x={contextMenu.screen.x}
          y={contextMenu.screen.y}
          onClose={closeContextMenu}
          actions={(() => {
            const objects = layerObjects(p).filter((o) =>
              contextMenu.ids.includes(o.id),
            );
            const allowed =
              objects.length > 0 &&
              objects.every(
                (o) =>
                  objectState(p, documentKey, o).editable &&
                  canCaptureObject(p, documentKey, o.id),
              );
            const items: ContextAction[] = ['properties'];
            if (allowed) {
              items.push('move');
              if (!groupSelection) items.push('copy');
              items.push('rotate', 'mirror');
              if (contextMenu.ids.length > 1) items.push('align-selection');
              if (
                objects.length === 1 &&
                !groupSelection &&
                (p.polylines.some((v) => v.id === objects[0].id) ||
                  p.bars.some(
                    (v) => v.id === objects[0].id && v.kind === 'free',
                  ))
              ) {
                items.push('insert-vertex', 'remove-vertex');
                if (!p.polylines.find((v) => v.id === objects[0].id)?.closed)
                  items.push('extend-vertex');
                if (
                  p.bars.some(
                    (b) => b.id === objects[0].id && b.kind === 'free',
                  )
                )
                  items.push('edit-segment', 'lengthen-bar');
              }
              items.push('delete');
            }
            if (!objects.length) items.push('fit');
            return items;
          })()}
          onAction={(a) => {
            setContextMenu(null);
            if (a === 'properties') {
              setSidebarOpen(true);
              setSidebarTab('properties');
              setFocus(false);
            } else action(a);
          }}
        />
      )}
      {visibilityOpen && (
        <Suspense
          fallback={<div className="busy-overlay">Abrindo visibilidade…</div>}
        >
          <VisibilityDialog
            key={`${p.id}:${visibilityKey}`}
            project={p}
            contextKey={visibilityKey}
            detailId={!activeSheet ? isolatedDetailId : undefined}
            onChange={(next) => commit(() => next)}
            onClose={() => setVisibilityOpen(false)}
          />
        </Suspense>
      )}
      {plotOpen && (
        <Suspense
          fallback={<div className="busy-overlay">Abrindo plotagem…</div>}
        >
          <PlotDialog
            project={p}
            onChange={(next) => commit(() => next)}
            onClose={() => setPlotOpen(false)}
          />
        </Suspense>
      )}
      {layersOpen && (
        <Suspense
          fallback={<div className="busy-overlay">Abrindo layers…</div>}
        >
          <LayerManager
            contextKey={selectedView ? `view:${selectedView}` : documentKey}
            project={p}
            objectIds={selected.length ? selected : maskId ? [maskId] : []}
            onChange={(next) => commit(() => next)}
            onSelect={(ids) => select(ids)}
            onClose={() => setLayersOpen(false)}
          />
        </Suspense>
      )}
      {cloneRequest && cloneRequest.projectId === p.id && (
        <Suspense
          fallback={<div className="busy-overlay">Preparando cópia…</div>}
        >
          <ArmatureCloneDialog
            project={p}
            request={cloneRequest}
            scopeDetailId={isolatedDetailId}
            onClose={() => setCloneRequest(null)}
            onApply={(result) => {
              if (
                !result.ok ||
                !commit((current) => applyRebarBatch(current, result))
              )
                return false;
              setCloneRequest(null);
              setTool('select');
              select(result.receipt.createdIds);
              notify(
                'Armadura completa duplicada com novos IDs e vínculos remapeados.',
              );
              return true;
            }}
          />
        </Suspense>
      )}
      {cadSettingsOpen && (
        <CadSettingsDialog
          project={p}
          onClose={() => setCadSettingsOpen(false)}
          onSave={(base, value) => {
            if (historyRef.current.present !== base) {
              notify('O projeto mudou; reabra as configurações.');
              return false;
            }
            if (JSON.stringify(cadDefaults(base)) === JSON.stringify(value))
              return true;
            return commit((current) => setCadDefaults(current, value));
          }}
          onManager={(a) => {
            setCadSettingsOpen(false);
            action(a);
          }}
        />
      )}
      {maskBatch && (
        <MaskBatchDialog
          key={maskBatch.token}
          request={maskBatch}
          onClose={() => setMaskBatch(null)}
          onContext={(owner) => batchContext(owner)}
          onGeneral={() => batchContext(maskBatch.owner, true)}
          onImport={applyMaskImport}
          onAssociate={applyMaskAssociation}
        />
      )}
      {maskReceipt && (
        <MaskBatchResults
          project={p}
          receipt={maskReceipt}
          onClose={() => setMaskReceipt(null)}
          onOpen={(owner, id) => {
            if (!openMaskContext(owner)) return;
            setMaskReceipt(null);
            setSelectedRaw([]);
            setMaskId(id);
            setSidebarOpen(true);
            setFocus(false);
            setSidebarTab('properties');
            setPage('drawing');
            requestAnimationFrame(() => cad.current?.fit());
          }}
        />
      )}
      {maskControl && (
        <MaskControl
          project={p}
          owner={activeDetailId}
          context={maskDrawingContext}
          creating={creatingMask}
          activeId={drawingMaskId}
          initial={maskId ?? drawingMaskId}
          entity={nativeEntity}
          onActivate={activateDrawingMask}
          onOpenContext={openMaskContext}
          onOffset={startMaskOffset}
          onManipulate={startMaskManip}
          onCadEdit={startMaskCad}
          onCalibrate={startMaskCalibration}
          onBatch={(mode) => startMaskBatch(mode)}
          onClose={() => setMaskControl(false)}
          onSelect={(id) => {
            const current = historyRef.current.present,
              m = current.masks.find((m) => m.id === id);
            if (!m || !openMaskContext(current.hierarchy.objectDetails[id]))
              return false;
            setSelectedRaw([]);
            setMaskId(id);
            setSidebarOpen(true);
            setFocus(false);
            setSidebarTab('properties');
            return true;
          }}
          onCreate={(name, owner, base) => {
            if (historyRef.current.present !== base)
              throw new Error(
                'O projeto mudou. Confira o contexto e tente novamente.',
              );
            const created = createDrawingMask(
              base,
              name,
              owner,
              maskDrawingContext,
            );
            if (!commit(() => created.project))
              throw new Error(
                'A criação foi bloqueada. Confira os layers e o contexto.',
              );
            setDrawingMaskChoice({ projectId: base.id, id: created.mask.id });
            setSelectedRaw([]);
            setMaskId(null);
            setNativeEntity(undefined);
            notify(
              `Máscara criada e ativa: ${created.mask.name} · ${detailPath(created.project, owner)}. Escolha a ferramenta para desenhar.`,
            );
            return created.mask;
          }}
          onChange={(m, expected) => {
            const current = historyRef.current.present;
            assertLocalMaskEdit(current, expected, m, maskDrawingContext);
            const ok = commit(() => ({
              ...current,
              masks: current.masks.map((old) => (old.id === m.id ? m : old)),
            }));
            if (
              ok &&
              maskId === m.id &&
              nativeEntity &&
              !m.primitives.some((q) => q.id === nativeEntity)
            )
              setNativeEntity(undefined);
            return ok;
          }}
          onDelete={(id) => {
            const current = historyRef.current.present;
            const target = current.masks.find((m) => m.id === id);
            if (
              target?.primitives.some(
                (q) =>
                  q.layerId &&
                  !layerState(current, documentKey, q.layerId).editable,
              )
            ) {
              notify(
                'Há entidades da máscara em layers protegidos. Confira os layers antes de excluir.',
              );
              return false;
            }
            if (
              !current.masks.some((m) => m.id === id) ||
              current.hierarchy.objectDetails[id] !== activeDetailId ||
              !editable(id) ||
              activeSheet
            )
              return false;
            const ok = commit(() => ({
              ...current,
              masks: current.masks.filter((m) => m.id !== id),
            }));
            if (ok && maskId === id) setMaskId(null);
            return ok;
          }}
        />
      )}
      {modal === 'new' && (
        <Suspense
          fallback={
            <div className="modal-backdrop" role="status">
              Abrindo Novo projeto…
            </div>
          }
        >
          <NewProjectDialog
            current={p}
            pendingWork={
              !!(
                draft.length ||
                transformRequest ||
                alignmentRequest ||
                vertexRequest ||
                scheduleRequest
              )
            }
            onClose={() => setModal(null)}
            onSaveCurrent={async (base) => {
              if (historyRef.current.present !== base)
                throw new Error(
                  'O projeto mudou. Reabra o assistente antes de salvar.',
                );
              return saveFile(
                `${safeName(base.name)}.armstruct.json`,
                JSON.stringify(base, null, 2),
                'application/json',
                'json',
              );
            }}
            onCreate={(draft, base) => {
              if (historyRef.current.present !== base) {
                notify(
                  'O projeto aberto mudou. Reabra o assistente para criar.',
                );
                return false;
              }
              const result = prepareProjectSetup(draft);
              if (!result.ok) {
                notify(result.issues.map((i) => i.message).join(' '));
                return false;
              }
              if (!commit(() => result.project)) return false;
              setContext({
                projectId: result.project.id,
                detailId: result.activeDetailId,
              });
              setSelectedRaw([]);
              setMaskId(null);
              setSelectedView(undefined);
              setSelectedSchedule(false);
              setTool('select');
              setCommand('');
              setDraft([]);
              setPageRaw('drawing');
              setDetailTransfer(null);
              detailRequest.current = null;
              setCadInterpretation(null);
              setCloneRequest(null);
              setPlotOpen(false);
              setLayersOpen(false);
              setVisibilityOpen(false);
              setFabricationOpen(false);
              setNumberingOpen(false);
              setRepetitionDetailId(undefined);
              setExampleReviewOpen(false);
              sessions.current.clear();
              setDocuments({
                projectId: result.project.id,
                active: 'model',
                opened: [],
              });
              setSidebarTab('project');
              setSidebarOpen(true);
              setFocus(false);
              setTab('Armaduras');
              setModal(null);
              notify(
                'Projeto criado. A estrutura está na aba Projeto e o detalhamento inicial está ativo.',
              );
              return true;
            }}
          />
        </Suspense>
      )}
      {modal && modal !== 'new' && (
        <div
          className="modal-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'group'
                ? 'Agrupar em detalhamento'
                : modal === 'split'
                  ? 'Dividir barra'
                  : 'Guia de uso'
            }
          >
            <button
              className="modal-close"
              aria-label="Fechar"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            {modal === 'group' ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    const current = historyRef.current.present;
                    const grouped = groupInDetail(
                      current,
                      maskId ? [maskId] : selected,
                      groupName,
                      groupElementId,
                    );
                    if (!commit(() => grouped.project)) return;
                    setContext({ projectId: current.id, detailId: grouped.id });
                    setSelectedRaw(
                      detailObjectIds(grouped.project, grouped.id),
                    );
                    setMaskId(null);
                    setModal(null);
                    setTool('select');
                    setSidebarTab('properties');
                    notify(
                      'Objetos agrupados sem alterar o aço. Duplo clique no conjunto abre a edição isolada.',
                    );
                  } catch (e) {
                    notify(
                      e instanceof Error
                        ? e.message
                        : 'Não foi possível agrupar.',
                    );
                  }
                }}
              >
                <h2>Agrupar em detalhamento</h2>
                <p>Os objetos mantêm seus IDs, coordenadas e dados físicos.</p>
                <label className="field">
                  <span>Nome do detalhamento</span>
                  <input
                    autoFocus
                    aria-label="Nome do novo detalhamento"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  <span>Grupo de elementos</span>
                  <select
                    aria-label="Grupo do novo detalhamento"
                    value={groupElementId}
                    onChange={(e) => setGroupElementId(e.target.value)}
                  >
                    {p.hierarchy.elements.map((e) => (
                      <option key={e.id} value={e.id}>
                        {
                          p.hierarchy.floors.find((f) => f.id === e.floorId)
                            ?.name
                        }{' '}
                        / {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    Agrupar objetos
                  </button>
                </div>
              </form>
            ) : modal === 'split' && chosen ? (
              <>
                <span className="eyebrow">{chosen.mark} · EDIÇÃO DA BARRA</span>
                <h2>Dividir barra</h2>
                <p>
                  Cria duas posições e mantém a quantidade de peças. O traspasse
                  é um comprimento informado pelo projetista; não há cálculo
                  automático de ancoragem.
                </p>
                <NumberField
                  label="Comprimento até o corte"
                  value={splitAt / 10}
                  onChange={(v) => setSplitAt(v * 10)}
                  min={0.01}
                  suffix="cm"
                />
                <NumberField
                  label="Traspasse informado"
                  value={lap / 10}
                  onChange={(v) => setLap(v * 10)}
                  min={0}
                  suffix="cm"
                />
                <p className="field-help">
                  O corte é medido pelo eixo da barra, incluindo as dobras. Toda
                  a sobreposição precisa caber em um trecho reto. Comprimento
                  atual: {format(geometry(chosen).length / 10)} cm.
                </p>
                <div className="modal-actions">
                  <button onClick={() => setModal(null)}>Cancelar</button>
                  <button
                    className="primary"
                    onClick={() => {
                      try {
                        const next = applyRebarBatch(
                          p,
                          executeRebarBatch(
                            p,
                            [
                              {
                                type: 'bar.split',
                                id: chosen.id,
                                station: splitAt,
                                lap,
                              },
                            ],
                            {
                              units: 'mm',
                              scopeDetailId: isolationRef.current,
                              layerContext: documentKey,
                            },
                          ),
                        );
                        if (!commit(() => next)) return;
                        setModal(null);
                        notify(
                          'Barra dividida. As duas posições e o traspasse já entram no quantitativo.',
                        );
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Aplicar divisão
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  DESENHAR. DETALHAR. QUANTIFICAR.
                </span>
                <h2>Seu ambiente de armaduras.</h2>
                <div className="help-steps">
                  <p>
                    <b>01 · Referencie a fôrma</b>Importe DXF ou DWG. Confira
                    unidade e escala com Medir. Camadas e opacidade estão nas
                    propriedades da máscara.
                  </p>
                  <p>
                    <b>02 · Crie suas posições</b>B desenha barras por vértices;
                    E cria estribos com dois cantos. Use diâmetro de dobra e
                    ganchos definidos para o projeto.
                  </p>
                  <p>
                    <b>03 · Detalhe e distribua</b>Crie rebatimentos, faixas,
                    cotas e chamadas vinculadas. Divida barras com traspasse
                    informado e confira os quantitativos na relação de aço.
                  </p>
                  <p>
                    <b>04 · Entregue o desenho</b>Salve o projeto completo e
                    exporte DXF, prancha PDF e CSV. Configure a escala por vista
                    na aba Pranchas; o DXF preserva a geometria em mm. Atualize
                    a RA se estiver bloqueada e desatualizada.
                  </p>
                </div>
                <div className="shortcut-grid">
                  <span>
                    <kbd>Enter</kbd> Concluir barra
                  </span>
                  <span>
                    <kbd>Esc</kbd> Cancelar comando
                  </span>
                  <span>
                    <kbd>F</kbd> Enquadrar
                  </span>
                  <span>
                    <kbd>Ctrl Z</kbd> Desfazer
                  </span>
                  <span>
                    <kbd>F3</kbd> Encaixes
                  </span>
                  <span>
                    <kbd>F8</kbd> Ortogonal
                  </span>
                  <span>
                    <kbd>F4</kbd> Painel lateral
                  </span>
                  <span>
                    <kbd>Ctrl F1</kbd> Faixa de comandos
                  </span>
                  <span>
                    <kbd>Ctrl 0</kbd> Foco no CAD
                  </span>
                  <span>
                    <kbd>PL</kbd> Polilinha CAD
                  </span>
                  <span>
                    <kbd>@500,0</kbd> Relativo em mm
                  </span>
                  <span>
                    <kbd>@500&lt;90</kbd> Polar
                  </span>
                </div>
                <p className="field-help">
                  Para seguir fôrma, selecione uma polilinha da máscara.
                  Contornos fechados são deslocados para dentro; linhas abertas,
                  para a esquerda do sentido do desenho. As terminações devem
                  ser conferidas pelo projetista.
                </p>
                <p className="field-help">
                  Leitura DWG: LibreDWG / GPL-3.0. O relatório de importação
                  informa entidades omitidas. Arquivos XREF externos e objetos
                  proprietários não são carregados.
                </p>
                <button className="primary" onClick={() => setModal(null)}>
                  Começar a detalhar
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
