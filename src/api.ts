/** Public executable domain facade. No React, window, document or transport protocol. */
export {
  REBAR_API_VERSION,
  REBAR_CAPABILITIES,
  RebarApiError,
  executeRebarBatch,
  applyRebarBatch,
} from './domain/rebarApi';
export type {
  RebarDefinition,
  RebarPatch,
  RebarCommand,
  RebarOptions,
  RebarIssue,
  RebarBatchResult,
  RebarOperationReceipt,
} from './domain/rebarApi';
export type { Project, Point, Bar, BarRepresentation } from './domain/types';

export {
  setDetailRepetition,
  repetitionCandidates,
  previewMergeRepetitions,
  applyMergeRepetitions,
} from './domain/detailRepetition';
export {
  barQuantities,
  detailTitle,
  localBarQuantities,
  quantityLabel,
  quantityExpression,
  quantitySourceLabel,
  assemblyLabel,
} from './domain/detailQuantities';
export type { DetailRepetition } from './domain/types';

export {
  FABRICATION_RULES,
  fabricationSignature,
  fabricationPositions,
  fabricationCandidates,
  previewFabrication,
  groupFabrication,
  ungroupFabrication,
} from './domain/fabrication';
export type {
  FabricationPosition,
  BarTermination,
  ScheduleContribution,
  BarQuantitySource,
} from './domain/types';

export { previewRenumber, applyRenumber } from './domain/numbering';
export type { RenumberOptions } from './domain/numbering';
export { nextFreeMark } from './domain/marks';
export type { NumberingPolicy } from './domain/marks';

export {
  representationPoint,
  representationPoints,
  representationPrimitives,
  showsPhysicalDescription,
} from './domain/representations';

export {
  cloneArmatureGraph,
  planArmatureClone,
  ArmatureCloneError,
} from './domain/editing';
export type { ArmatureCloneOptions } from './domain/editing';

export {
  defaultLayers,
  createLayer,
  editLayers,
  editLayerPlotStyles,
  assignLayer,
  removeLayer,
  layerUsage,
  resolveStyle,
  LINE_TYPES,
} from './domain/layers';
export type { DrawingLayer, DrawingStyle, LayerBinding } from './domain/types';

export {
  setLayerState,
  layerState,
  layerProjection,
  saveLayerProfile,
  applyLayerProfile,
  profileLabel,
} from './domain/layerProfiles';

export {
  plotSettings,
  setPlotSettings,
  resolvePlotStyle,
  plotPrimitives,
  PLOT_LINE_TYPES,
} from './domain/plotting';
export type { PlotStyle, PlotSettings } from './domain/types';

export {
  hideObjects,
  isolateObjects,
  endObjectIsolation,
  restoreObjects,
  showAllObjects,
  setVisibility,
  visibilityState,
  visibilityProjection,
  visibilityReasons,
} from './domain/visibility';

export { transformSelection, angleByPoints } from './domain/transforms';
export type { SelectionTransform } from './domain/transforms';

export {
  alignSelection,
  modelAlignmentItems,
  paperAlignmentItems,
  planAlignmentItems,
} from './domain/alignment';
export type {
  AlignmentItem,
  AlignmentOptions,
  AlignmentMove,
} from './domain/alignment';
export { editVertices, editablePath } from './domain/vertices';
export type { VertexEdit } from './domain/vertices';
export {
  barSegments,
  dimensionalPoints,
  terminalExtensionAt,
  parseLength,
} from './domain/segments';
export type { DimensionalEdit } from './domain/segments';

export {
  sheetScheduleData,
  sheetScheduleGeometry,
  defaultSheetSchedule,
  setSheetSchedule,
} from './domain/sheetSchedule';
export type { SheetSteelSchedule } from './domain/types';

export {
  newProjectSetup,
  prepareProjectSetup,
  addProjectSetupNode,
  editProjectSetupNode,
  projectSetupIssues,
  projectSetupRemoval,
  removeProjectSetupNode,
} from './domain/projectSetup';
export type {
  ProjectSetupDraft,
  ProjectSetupIssue,
} from './domain/projectSetup';

export {
  appendMaskShape,
  createDrawingMask,
  assertLocalMaskEdit,
  maskDrawingState,
  maskPath,
  localDrawingLayer,
} from './domain/maskDrawing';
export type { MaskDrawingContext } from './domain/maskDrawing';

/** Straight form-face following: preview only; create with the atomic bar.create operation. */
export {
  FOLLOW_TOLERANCE_MM,
  MAX_FOLLOW_EDGES,
  followEdges,
  buildFollowChain,
  chooseFollowSide,
  previewFollow,
} from './domain/followForm';
export type {
  FollowContext,
  FollowEdge,
  FollowChain,
  FollowParameters,
} from './domain/followForm';

export {
  cadDefaults,
  factoryCadDefaults,
  validateCadDefaults,
  setCadDefaults,
  barCadDefaults,
  annotationCadDefaults,
  representationCadDefaults,
} from './domain/cadDefaults';
export type { CadDefaults, CadCategory } from './domain/cadDefaults';

export {
  criteriaBar,
  criteriaFromBar,
  withStirrupRange,
} from './domain/stirrups';
export { defaultStirrupCriteria } from './domain/stirrupSchema';
export type { StirrupCriteria, StirrupProfile } from './domain/stirrupSchema';
