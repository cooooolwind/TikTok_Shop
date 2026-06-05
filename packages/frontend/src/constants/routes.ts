/** 路由路径常量，避免组件中硬编码字符串 */
export const ROUTES = {
  HOME: '/',
  MATERIALS: '/materials',
  MATERIAL_DETAIL: '/materials/:id',
  SCRIPTS: '/scripts',
  SCRIPT_GENERATE: '/scripts/generate',
  SCRIPT_EDITOR: '/scripts/:id',
  REFERENCES: '/references',
  REFERENCE_DETAIL: '/references/:id',
  TEMPLATES: '/templates',
  CREATION: '/creation',
  CREATION_NEW: '/creation/new',
  CREATION_TASK: '/creation/tasks/:taskId',
  CREATION_PREVIEW: '/creation/tasks/:taskId/preview',
  CREATION_EDITOR: '/creation/tasks/:taskId/editor',
  ANALYTICS: '/analytics',
  EDITOR: '/editor',
  EDITOR_TASK: '/editor/:taskId',
} as const;

/** 构造动态路径 */
export const routePath = {
  materialDetail: (id: string) => `/materials/${id}`,
  scriptEditor: (id: string) => `/scripts/${id}`,
  referenceDetail: (id: string) => `/references/${id}`,
  creationTask: (taskId: string) => `/creation/tasks/${taskId}`,
  creationPreview: (taskId: string) => `/creation/tasks/${taskId}/preview`,
  creationEditor: (taskId: string) => `/creation/tasks/${taskId}/editor`,
  editorTask: (taskId: string) => `/editor/${taskId}`,
};
