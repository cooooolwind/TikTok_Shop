// 通用
export type { ApiResponse, PaginatedResponse, ErrorResponse, PaginationQuery } from './common';
export { ErrorCode } from './errors';

// 素材
export type {
  MaterialType,
  MaterialCategory,
  MaterialStatus,
  SourceDeclaration,
  VideoSlice,
  Material,
  MaterialMetadata,
  MaterialDetail,
  MaterialUploadResponse,
  AnalyzeResponse,
  SimilarSearchRequest,
  SimilarSearchResult,
  MaterialListQuery,
} from './material';

// 参考视频
export type {
  StoryboardItem,
  ReferenceAnalysis,
  AnalysisStatus,
  ReferenceVideo,
  CreateReferenceRequest,
  ReferenceListQuery,
} from './reference';

// 模板
export type {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateListQuery,
} from './template';

// 剧本
export type {
  ProductInfo,
  Scene,
  ScriptMode,
  ScriptStatus,
  Script,
  ScriptPreferences,
  CreateScriptRequest,
  GenerateScriptRequest,
  GenerateScriptQueuedResponse,
  BatchGenerateRequest,
  BatchGenerateResponse,
  UpdateScriptRequest,
  UpdateSceneRequest,
  AddSceneRequest,
  ReorderScenesRequest,
  RegenerateSceneRequest,
  ScriptListQuery,
} from './script';

// 创作
export type {
  GenerationStatus,
  VideoOptions,
  TaskProgress,
  TaskResult,
  VideoSegmentResult,
  TaskError,
  RenderEngine,
  TransitionType,
  TransitionConfig,
  TimelineClip,
  TimelineTransition,
  VideoEditProject,
  GenerationTask,
  CreateVideoRequest,
  QuickGenerateRequest,
  RegenerateSceneVideoRequest,
  ExportRequest,
  ExportResponse,
  GenerationListQuery,
} from './generation';

// TTS
export type { Voice, TTSPreviewRequest, TTSPreviewResponse } from './tts';

// BGM
export type { BGM, BGMListQuery } from './bgm';

// 数据看板
export type {
  AnalyticsQuery,
  TrendsQuery,
  PeriodComparison,
  OverviewData,
  TrendData,
  AttributionData,
  DurationDistribution,
} from './analytics';

// 系统
export type { ServiceStatus, HealthResponse, UploadResponse } from './system';

// WebSocket
export {
  WsEvent,
  type SubscribePayload,
  type UnsubscribePayload,
  type TaskProgressEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type MaterialAnalyzedEvent,
  type MaterialAnalysisFailedEvent,
  type MaterialAnalysisStepEvent,
  type MaterialAnalysisStep,
  type ScriptGeneratedEvent,
} from './websocket';
