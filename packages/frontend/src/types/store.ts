import type {
  Material, MaterialDetail, MaterialListQuery, MaterialType,
  Script, Scene, ScriptListQuery, ScriptMode, ScriptStatus, UpdateScriptRequest,
  CreateScriptRequest, GenerateScriptQueuedResponse, GenerateScriptRequest, ProductInfo,
  GenerationTask, GenerationStatus, GenerationListQuery, ExportResponse,
  TaskProgress, TaskResult, TaskError, VideoOptions, ExportRequest,
  ReferenceVideo, ReferenceListQuery,
  Template, TemplateListQuery,
  Voice, BGM, BGMListQuery,
  OverviewData, TrendData, AttributionData, DurationDistribution,
  AnalyticsQuery, TrendsQuery,
  CostOverview, CostTrend, CostBreakdown, TemplateCostItem, HighCostVideo,
  ConversionOverview, ConversionTrend, CategoryConversion, FunnelStage, DurationCVR,
  StrategyFactor, StrategyFormula, ABComparison, RhythmCompleteness, SubtitleStrategy, CTAPosition, BGMEffect,
  HomeStats,
  MaterialAnalysisStep,
} from '@aigc/shared-types';

// ==============================
// Material Store
// ==============================

export interface MaterialState {
  items: Material[];
  total: number;
  loading: boolean;
  selectedMaterial: MaterialDetail | null;
  filters: MaterialListQuery;
  analyzingIds: Set<string>;
  analysisStepById: Record<string, MaterialAnalysisStep>;

  // 上传
  uploadVisible: boolean;
  uploading: boolean;
  uploadProgress: number;

  fetchList: (params?: MaterialListQuery, append?: boolean) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  updateMaterial: (id: string, data: Partial<Material>) => Promise<void>;
  upload: (file: File, category: string, sourceDeclaration: string, tags?: string[], name?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  batchRemove: (ids: string[]) => Promise<void>;
  triggerAnalysis: (id: string) => Promise<void>;
  setMaterialAnalyzed: (id: string, tags: string[], description: string) => void;
  setMaterialAnalysisFailed: (id: string, error: string) => void;
  setMaterialAnalysisStep: (id: string, step: MaterialAnalysisStep) => void;
  setMaterialEmbeddingComplete: (id: string) => void;
  setMaterialEmbeddingFailed: (id: string, error?: string) => void;
  reEmbedMaterial: (id: string) => Promise<void>;
  similarSearch: (query: string, type?: MaterialType, limit?: number, threshold?: number, mode?: 'semantic' | 'text') => Promise<{ material: Material; score: number }[]>;
  semanticResults: { material: Material; score: number }[];
  semanticLoading: boolean;
  semanticQuery: string;
  semanticSearch: (query: string, type?: MaterialType) => Promise<void>;
  clearSemanticSearch: () => void;
  setFilters: (filters: Partial<MaterialListQuery>) => void;
  setUploadVisible: (visible: boolean) => void;
  clearSelection: () => void;
}

// ==============================
// Reference Store
// ==============================

export interface ReferenceState {
  items: ReferenceVideo[];
  total: number;
  loading: boolean;
  selectedReference: ReferenceVideo | null;
  filters: ReferenceListQuery;

  fetchList: (params?: ReferenceListQuery) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  create: (data: { source_url: string; source_platform: string; category: string; source_declaration: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: Partial<ReferenceListQuery>) => void;
}

// ==============================
// Template Store
// ==============================

export interface TemplateState {
  items: Template[];
  total: number;
  loading: boolean;
  selectedTemplate: Template | null;
  filters: TemplateListQuery;

  fetchList: (params?: TemplateListQuery) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  create: (data: Omit<Template, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  update: (id: string, data: Partial<Template>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: Partial<TemplateListQuery>) => void;
}

// ==============================
// Script Store
// ==============================

export interface ScriptState {
  items: Script[];
  total: number;
  loading: boolean;
  filters: ScriptListQuery;

  currentScript: Script | null;
  isDirty: boolean;
  generating: boolean;

  fetchList: (params?: ScriptListQuery) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;

  create: (params: CreateScriptRequest) => Promise<Script>;
  generate: (params: GenerateScriptRequest) => Promise<GenerateScriptQueuedResponse>;
  retry: (id: string) => Promise<{ task_id: string; status: 'queued' }>;
  batchGenerate: (params: {
    product_info: ProductInfo;
    count: number;
    strategy_variations?: string[];
    factor_variations?: Record<string, string[]>;
  }) => Promise<{ task_id: string; count: number }>;

  updateScript: (id: string, data: UpdateScriptRequest) => Promise<void>;
  confirm: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;

  // 分镜 CRUD（乐观更新 + 脏标记）
  updateScene: (scriptId: string, sceneId: string, data: Partial<Scene>) => void;
  addScene: (scriptId: string, afterOrder: number, scene: Omit<Scene, 'id' | 'order'>) => Promise<void>;
  removeScene: (scriptId: string, sceneId: string) => void;
  reorderScenes: (scriptId: string, sceneIds: string[]) => Promise<void>;
  regenerateScene: (
    scriptId: string, sceneId: string,
    target: 'dialogue' | 'visual_prompt' | 'all',
    instruction?: string,
  ) => Promise<void>;

  setFilters: (filters: Partial<ScriptListQuery>) => void;
  resetCurrentScript: () => void;
}

// ==============================
// Creation Store
// ==============================

export interface CreationState {
  tasks: GenerationTask[];
  total: number;
  loading: boolean;
  filters: GenerationListQuery;

  currentTask: GenerationTask | null;
  creating: boolean;

  fetchTasks: (params?: GenerationListQuery) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;

  createVideo: (params: { script_id: string; options?: VideoOptions }) => Promise<GenerationTask>;
  quickGenerate: (params: { product_info: ProductInfo; template_id?: string; options?: VideoOptions }) => Promise<GenerationTask>;

  retry: (taskId: string) => Promise<void>;
  cancel: (taskId: string) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
  exportVideo: (
    taskId: string,
    format: string,
    resolution: string,
    quality: string,
    options?: Pick<ExportRequest, 'render_engine' | 'transition'>,
  ) => Promise<ExportResponse>;
  regenerateSceneVideo: (taskId: string, sceneId: string, instruction?: string, materialId?: string) => Promise<void>;

  // WebSocket 驱动
  updateTaskProgress: (taskId: string, progress: TaskProgress, result?: TaskResult) => void;
  setTaskDone: (taskId: string, result: TaskResult) => void;
  setTaskFailed: (taskId: string, error: TaskError) => void;

  setFilters: (filters: Partial<GenerationListQuery>) => void;
}

// ==============================
// TTS Store
// ==============================

export interface TTSState {
  voices: Voice[];
  loading: boolean;
  previewing: boolean;
  previewAudioUrl: string | null;

  fetchVoices: () => Promise<void>;
  preview: (text: string, voiceId: string, speed?: number) => Promise<{ audio_url: string; duration: number }>;
  clearPreview: () => void;
}

// ==============================
// BGM Store
// ==============================

export interface BGMState {
  items: BGM[];
  loading: boolean;
  filters: BGMListQuery;

  fetchList: (params?: BGMListQuery) => Promise<void>;
  setFilters: (filters: Partial<BGMListQuery>) => void;
}

// ==============================
// Analytics Store
// ==============================

export interface AnalyticsState {
  overview: OverviewData | null;
  attribution: AttributionData[];
  durationDistribution: DurationDistribution[];
  materialDistribution: {
    type_distribution: { type: string; count: number }[];
    category_distribution: { category: string; count: number }[];
    status_distribution: { status: string; count: number }[];
    ai_tag_coverage: number;
  } | null;
  dateRange: AnalyticsQuery;
  granularity: 'day' | 'week' | 'month';
  loading: boolean;
  overviewLoading: boolean;
  attributionLoading: boolean;

  setDateRange: (range: AnalyticsQuery) => void;
  setGranularity: (g: 'day' | 'week' | 'month') => void;
  fetchOverview: () => Promise<void>;
  fetchAttribution: () => Promise<void>;
  fetchDurationDistribution: () => Promise<void>;
  fetchMaterialDistribution: () => Promise<void>;
}

// ==============================
// Cost Analytics Store
// ==============================

export interface CostAnalyticsState {
  overview: CostOverview | null;
  trends: CostTrend[];
  breakdown: CostBreakdown[];
  templateCost: TemplateCostItem[];
  highCostVideos: HighCostVideo[];
  dateRange: AnalyticsQuery;
  granularity: 'day' | 'week' | 'month';
  loading: boolean;

  setDateRange: (range: AnalyticsQuery) => void;
  setGranularity: (g: 'day' | 'week' | 'month') => void;
  fetchOverview: () => Promise<void>;
  fetchTrends: () => Promise<void>;
  fetchBreakdown: () => Promise<void>;
  fetchTemplateCost: () => Promise<void>;
  fetchHighCostVideos: () => Promise<void>;
}

// ==============================
// Conversion Analytics Store
// ==============================

export interface ConversionAnalyticsState {
  overview: ConversionOverview | null;
  trends: ConversionTrend[];
  categoryConversion: CategoryConversion[];
  funnel: FunnelStage[];
  durationCVR: DurationCVR[];
  dateRange: AnalyticsQuery;
  granularity: 'day' | 'week' | 'month';
  loading: boolean;

  setDateRange: (range: AnalyticsQuery) => void;
  setGranularity: (g: 'day' | 'week' | 'month') => void;
  fetchOverview: () => Promise<void>;
  fetchTrends: () => Promise<void>;
  fetchCategoryConversion: () => Promise<void>;
  fetchFunnel: () => Promise<void>;
  fetchDurationCVR: () => Promise<void>;
}

// ==============================
// Strategy Analytics Store
// ==============================

export interface StrategyAnalyticsState {
  factors: StrategyFactor[];
  formula: StrategyFormula | null;
  abComparison: ABComparison | null;
  rhythm: RhythmCompleteness[];
  subtitle: SubtitleStrategy[];
  cta: CTAPosition[];
  bgm: BGMEffect[];
  dateRange: AnalyticsQuery;
  loading: boolean;

  setDateRange: (range: AnalyticsQuery) => void;
  fetchFactors: () => Promise<void>;
  fetchFormula: () => Promise<void>;
  fetchABComparison: () => Promise<void>;
  fetchRhythm: () => Promise<void>;
  fetchSubtitle: () => Promise<void>;
  fetchCTA: () => Promise<void>;
  fetchBGM: () => Promise<void>;
  fetchAll: () => Promise<void>;
}

// ==============================
// Home Store
// ==============================

export interface HomeStatsState {
  stats: HomeStats | null;
  loading: boolean;
  fetchStats: () => Promise<void>;
}

// ==============================
// UI Store
// ==============================

export type ThemeMode = 'system' | 'light' | 'dark';

export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
}

export interface UIState {
  sidebarCollapsed: boolean;
  globalLoading: boolean;
  notifications: NotificationItem[];
  themeMode: ThemeMode;
  mobileDrawerOpen: boolean;

  toggleSidebar: () => void;
  setGlobalLoading: (loading: boolean) => void;
  pushNotification: (notif: Omit<NotificationItem, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setMobileDrawerOpen: (open: boolean) => void;
}
