import type {
  Material, MaterialDetail, MaterialListQuery, MaterialType,
  Script, Scene, ScriptListQuery, ScriptMode, ScriptStatus,
  CreateScriptRequest, GenerateScriptQueuedResponse, GenerateScriptRequest, ProductInfo,
  GenerationTask, GenerationStatus, GenerationListQuery, ExportResponse,
  TaskProgress, TaskResult, TaskError, VideoOptions,
  ReferenceVideo, ReferenceListQuery,
  Template, TemplateListQuery,
  Voice, BGM, BGMListQuery,
  OverviewData, TrendData, AttributionData, DurationDistribution,
  AnalyticsQuery, TrendsQuery,
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
  similarSearch: (query: string, type?: MaterialType, limit?: number, threshold?: number) => Promise<{ material: Material; score: number }[]>;
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

  updateScript: (id: string, data: { narrative_framework?: string; visual_style?: string }) => Promise<void>;
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
  exportVideo: (taskId: string, format: string, resolution: string, quality: string) => Promise<ExportResponse>;
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
  trends: TrendData[];
  attribution: AttributionData[];
  durationDistribution: DurationDistribution[];
  dateRange: AnalyticsQuery;
  granularity: 'day' | 'week' | 'month';
  loading: boolean;
  overviewLoading: boolean;
  trendsLoading: boolean;
  attributionLoading: boolean;

  setDateRange: (range: AnalyticsQuery) => void;
  setGranularity: (g: 'day' | 'week' | 'month') => void;
  fetchOverview: () => Promise<void>;
  fetchTrends: () => Promise<void>;
  fetchAttribution: () => Promise<void>;
  fetchDurationDistribution: () => Promise<void>;
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
