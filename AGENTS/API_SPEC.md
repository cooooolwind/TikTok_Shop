# API 接口规范文档

> 前后端开发契约，基于 RESTful 风格，所有接口前缀为 `/api/v1`。

---

## 通用约定

### 基础信息

| 项目 | 说明 |
|------|------|
| Base URL | `http://localhost:3000/api/v1` |
| 协议 | HTTP/HTTPS |
| 数据格式 | JSON (`Content-Type: application/json`) |
| 文件上传 | `multipart/form-data` |
| 认证方式 | Bearer Token（Header: `Authorization: Bearer <token>`） |
| 时间格式 | ISO 8601（`2024-01-01T00:00:00.000Z`） |

### 统一响应结构

```typescript
// 成功响应
interface ApiResponse<T> {
  code: 0;
  data: T;
  message: string;
}

// 分页响应
interface PaginatedResponse<T> {
  code: 0;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  message: string;
}

// 错误响应
interface ErrorResponse {
  code: number; // 非0错误码
  message: string;
  details?: Record<string, string[]>; // 字段级错误
}
```

### 错误码定义

| 错误码 | 含义 |
|--------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 422 | 业务逻辑错误 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 通用查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，从 1 开始，默认 1 |
| pageSize | number | 每页条数，默认 20，最大 100 |
| sortBy | string | 排序字段 |
| sortOrder | `asc` \| `desc` | 排序方向，默认 `desc` |

---

## 一、素材模块 `/materials`

### 1.1 上传素材

`POST /materials/upload`

Content-Type: `multipart/form-data`

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 素材文件（图片/视频） |
| category | string | 否 | 分类：`product` / `scene` / `model` / `other` |
| source_declaration | string | 是 | 来源声明：`owned` / `public_commercial` / `reference` |
| tags | string[] | 否 | 自定义标签 |

**支持格式：**
- 图片：jpg, png, webp（最大 20MB）
- 视频：mp4, mov, webm（最大 500MB）

**响应：**

```typescript
interface MaterialUploadResponse {
  id: string;
  filename: string;
  type: "image" | "video";
  url: string;
  size: number;
  status: "uploaded" | "processing"; // processing 表示正在进行 AI 打标
}
```

### 1.2 素材列表

`GET /materials`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| type | `image` \| `video` | 素材类型筛选 |
| category | string | 分类筛选 |
| tags | string[] | 标签筛选（逗号分隔） |
| keyword | string | 关键词搜索（匹配文件名、描述、标签） |
| status | `uploaded` \| `processing` \| `ready` \| `failed` | 状态筛选 |

**响应：**

```typescript
interface Material {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnail_url: string;
  filename: string;
  size: number;
  category: string;
  tags: string[];
  source_declaration: string;
  ai_tags: string[];        // AI 自动打标结果
  ai_description: string;   // AI 生成的描述
  duration?: number;        // 视频时长（秒）
  resolution?: { width: number; height: number };
  status: "uploaded" | "processing" | "ready" | "failed";
  created_at: string;
  updated_at: string;
}
```

### 1.3 素材详情

`GET /materials/:id`

**响应：** 同上 `Material` 结构，额外包含：

```typescript
interface MaterialDetail extends Material {
  slices?: VideoSlice[];  // 视频切片（仅视频类型）
  metadata: {
    format: string;
    bitrate?: number;
    fps?: number;
    color_profile?: string;
  };
}

interface VideoSlice {
  id: string;
  start_time: number;
  end_time: number;
  description: string;
  thumbnail_url: string;
  tags: string[];
}
```

### 1.4 删除素材

`DELETE /materials/:id`

**响应：** `{ code: 0, message: "deleted" }`

### 1.5 批量删除素材

`DELETE /materials/batch`

**请求体：**

```json
{ "ids": ["id1", "id2", "id3"] }
```

### 1.6 触发 AI 打标

`POST /materials/:id/analyze`

手动触发/重新触发 AI 多模态理解。

**响应：**

```typescript
interface AnalyzeResponse {
  task_id: string;
  status: "queued";
}
```

### 1.7 视频切片列表

`GET /materials/:id/slices`

**响应：** `VideoSlice[]`

### 1.8 向量相似搜索

`POST /materials/search/similar`

**请求体：**

```typescript
interface SimilarSearchRequest {
  query: string;        // 文本描述
  type?: "image" | "video";
  limit?: number;       // 默认 10
  threshold?: number;   // 相似度阈值 0-1，默认 0.7
}
```

**响应：**

```typescript
interface SimilarSearchResult {
  material: Material;
  score: number; // 相似度分数
}[]
```

---

## 二、参考视频与模板 `/references` `/templates`

### 2.1 添加参考视频

`POST /references`

**请求体：**

```typescript
interface CreateReferenceRequest {
  source_url: string;           // 原始视频链接
  source_platform: string;      // 来源平台：tiktok / douyin / youtube
  category: string;             // 商品类目
  source_declaration: string;   // 来源声明
}
```

**响应：**

```typescript
interface ReferenceVideo {
  id: string;
  source_url: string;
  source_platform: string;
  category: string;
  source_declaration: string;
  analysis_status: "pending" | "analyzing" | "done" | "failed";
  analysis?: ReferenceAnalysis;
  created_at: string;
}

interface ReferenceAnalysis {
  hook: string;                 // 开头钩子
  selling_points: string[];     // 卖点提炼
  style: string;                // 视频风格
  duration: number;
  storyboard: StoryboardItem[];
}

interface StoryboardItem {
  order: number;
  duration: number;
  description: string;
  camera_motion: string;
  visual_elements: string[];
}
```

### 2.2 参考视频列表

`GET /references`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| category | string | 类目筛选 |
| source_platform | string | 平台筛选 |
| analysis_status | string | 分析状态筛选 |

### 2.3 参考视频详情

`GET /references/:id`

### 2.4 删除参考视频

`DELETE /references/:id`

### 2.5 创建灵感模板

`POST /templates`

**请求体：**

```typescript
interface CreateTemplateRequest {
  name: string;
  strategy: string;             // 策略描述
  factors: Record<string, string>; // 因子键值对
  constraints: string[];        // 约束条件
  applicable_categories: string[];
  derived_from?: string[];      // 关联的参考视频 ID
}
```

**响应：**

```typescript
interface Template {
  id: string;
  name: string;
  strategy: string;
  factors: Record<string, string>;
  constraints: string[];
  applicable_categories: string[];
  derived_from: string[];
  created_at: string;
  updated_at: string;
}
```

### 2.6 模板列表

`GET /templates`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| category | string | 适用类目筛选 |
| keyword | string | 名称/策略关键词搜索 |

### 2.7 模板详情

`GET /templates/:id`

### 2.8 更新模板

`PUT /templates/:id`

### 2.9 删除模板

`DELETE /templates/:id`

---

## 三、剧本模块 `/scripts`

### 3.1 生成剧本

`POST /scripts/generate`

**请求体：**

```typescript
interface GenerateScriptRequest {
  product_info: {
    name: string;
    description: string;
    category: string;
    selling_points: string[];
    target_audience?: string;
    price?: string;
    images?: string[];          // 商品图片 URL
    link?: string;              // 商品链接
  };
  template_id?: string;         // 使用指定模板
  reference_id?: string;        // 爆款仿写：指定参考视频
  mode: "template" | "imitation" | "free"; // 生成模式
  preferences?: {
    duration: number;           // 目标时长（秒），默认 15
    style?: string;             // 视频风格
    tone?: string;              // 语气风格
    language?: string;          // 语言
  };
}
```

**响应：**

```typescript
interface Script {
  id: string;
  product_info: ProductInfo;
  template_id?: string;
  reference_id?: string;
  mode: string;
  narrative_framework: string;  // 叙事框架描述
  visual_style: string;
  total_duration: number;
  scenes: Scene[];
  status: "draft" | "confirmed";
  created_at: string;
  updated_at: string;
}

interface Scene {
  id: string;
  order: number;
  description: string;
  camera_motion: string;        // 镜头运动
  duration: number;             // 秒
  dialogue: string;             // 台词/旁白
  bgm_style: string;           // 背景音乐风格
  subtitle: string;             // 字幕文本
  visual_prompt: string;        // 用于生成视觉内容的 prompt
  constraints: string[];        // 约束条件
}
```

### 3.2 批量生成剧本

`POST /scripts/generate/batch`

基于策略库+因子库动态组合，一次生成多套剧本。

**请求体：**

```typescript
interface BatchGenerateRequest {
  product_info: ProductInfo;
  count: number;                // 生成数量（2-5）
  strategy_variations?: string[]; // 不同策略
  factor_variations?: Record<string, string[]>; // 因子变体
}
```

**响应：**

```typescript
interface BatchGenerateResponse {
  task_id: string;
  status: "queued";
  count: number;
}
```

### 3.3 剧本列表

`GET /scripts`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | `draft` \| `confirmed` | 状态筛选 |
| mode | string | 生成模式筛选 |
| keyword | string | 关键词搜索 |

### 3.4 剧本详情

`GET /scripts/:id`

### 3.5 更新剧本（整体）

`PUT /scripts/:id`

**请求体：** 可更新字段：`narrative_framework`, `visual_style`, `status`

### 3.6 更新单个分镜

`PUT /scripts/:id/scenes/:sceneId`

**请求体：**

```typescript
interface UpdateSceneRequest {
  description?: string;
  camera_motion?: string;
  duration?: number;
  dialogue?: string;
  bgm_style?: string;
  subtitle?: string;
  visual_prompt?: string;
  constraints?: string[];
}
```

### 3.7 添加分镜

`POST /scripts/:id/scenes`

**请求体：**

```typescript
interface AddSceneRequest {
  after_order: number;          // 插入到第几个分镜之后（0 表示最前面）
  scene: Omit<Scene, "id" | "order">;
}
```

### 3.8 删除分镜

`DELETE /scripts/:id/scenes/:sceneId`

### 3.9 分镜排序

`PUT /scripts/:id/scenes/reorder`

**请求体：**

```json
{ "scene_ids": ["scene3", "scene1", "scene2"] }
```

### 3.10 重新生成分镜台词

`POST /scripts/:id/scenes/:sceneId/regenerate`

**请求体：**

```typescript
interface RegenerateSceneRequest {
  target: "dialogue" | "visual_prompt" | "all";
  instruction?: string;         // 用户指导意见
}
```

### 3.11 确认剧本

`POST /scripts/:id/confirm`

将剧本状态从 `draft` 改为 `confirmed`，锁定后可用于视频生成。

### 3.12 删除剧本

`DELETE /scripts/:id`

---

## 四、创作模块 `/generation`

### 4.1 一键成片

`POST /generation/create`

**请求体：**

```typescript
interface CreateVideoRequest {
  script_id: string;            // 已确认的剧本 ID
  options?: {
    resolution: "1080x1920" | "1920x1080" | "1080x1080";
    aspect_ratio: "9:16" | "16:9" | "1:1";
    tts_voice?: string;         // TTS 音色 ID
    tts_speed?: number;         // 语速 0.5-2.0，默认 1.0
    bgm_id?: string;            // 指定背景音乐
    bgm_volume?: number;        // BGM 音量 0-1，默认 0.3
    subtitle_style?: string;    // 字幕样式
  };
}
```

**响应：**

```typescript
interface GenerationTask {
  id: string;
  script_id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: {
    current_step: number;
    total_steps: number;
    step_name: string;
    percentage: number;
    message: string;
    estimated_remaining: number; // 预计剩余秒数
  };
  result?: {
    video_url: string;
    thumbnail_url: string;
    duration: number;
    resolution: string;
    aspect_ratio: string;
    file_size: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  retry_count: number;
  created_at: string;
  completed_at?: string;
}
```

### 4.2 快速成片（跳过剧本步骤）

`POST /generation/quick`

**请求体：**

```typescript
interface QuickGenerateRequest {
  product_info: ProductInfo;
  template_id?: string;
  options?: VideoOptions;
}
```

内部自动执行：生成剧本 → 确认 → 生成视频。

### 4.3 任务列表

`GET /generation/tasks`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态筛选 |
| script_id | string | 按剧本筛选 |

### 4.4 任务详情

`GET /generation/tasks/:taskId`

### 4.5 重试失败任务

`POST /generation/tasks/:taskId/retry`

### 4.6 取消任务

`POST /generation/tasks/:taskId/cancel`

### 4.7 单分镜重新生成

`POST /generation/tasks/:taskId/scenes/:sceneId/regenerate`

**请求体：**

```typescript
interface RegenerateSceneVideoRequest {
  instruction?: string;         // 调整说明
  material_id?: string;         // 替换素材
}
```

### 4.8 视频导出

`POST /generation/tasks/:taskId/export`

**请求体：**

```typescript
interface ExportRequest {
  format: "mp4" | "webm";
  resolution: "1080x1920" | "1920x1080" | "720x1280";
  quality: "high" | "medium" | "low";
}
```

**响应：**

```typescript
interface ExportResponse {
  download_url: string;
  expires_at: string;           // 下载链接过期时间
}
```

---

## 五、TTS 配音 `/tts`

### 5.1 获取可用音色列表

`GET /tts/voices`

**响应：**

```typescript
interface Voice {
  id: string;
  name: string;
  gender: "male" | "female";
  language: string;
  style: string;                // 风格描述
  preview_url: string;          // 试听音频
}[]
```

### 5.2 试听合成

`POST /tts/preview`

**请求体：**

```typescript
interface TTSPreviewRequest {
  text: string;                 // 最多 200 字
  voice_id: string;
  speed?: number;
}
```

**响应：**

```typescript
interface TTSPreviewResponse {
  audio_url: string;
  duration: number;
}
```

---

## 六、BGM 配乐 `/bgm`

### 6.1 BGM 列表

`GET /bgm`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| style | string | 风格筛选：`upbeat` / `calm` / `dramatic` / `funny` |
| duration_min | number | 最短时长 |
| duration_max | number | 最长时长 |

**响应：**

```typescript
interface BGM {
  id: string;
  name: string;
  style: string;
  duration: number;
  preview_url: string;
  bpm: number;
}[]
```

---

## 七、数据看板 `/analytics`

### 7.1 概览数据

`GET /analytics/overview`

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |

**响应：**

```typescript
interface OverviewData {
  total_generated: number;
  success_rate: number;         // 0-1
  avg_generation_time: number;  // 秒
  total_materials: number;
  total_scripts: number;
  period_comparison: {
    generated_change: number;   // 环比变化百分比
    success_rate_change: number;
  };
}
```

### 7.2 生成趋势

`GET /analytics/trends`

**查询参数：** 同上 + `granularity`: `day` | `week` | `month`

**响应：**

```typescript
interface TrendData {
  date: string;
  generated_count: number;
  success_count: number;
  failed_count: number;
  avg_duration: number;
}[]
```

### 7.3 因子归因分析

`GET /analytics/attribution`

**响应：**

```typescript
interface AttributionData {
  factor: string;
  value: string;
  usage_count: number;
  avg_performance_score: number;
  conversion_rate?: number;
}[]
```

### 7.4 耗时分布

`GET /analytics/duration-distribution`

**响应：**

```typescript
interface DurationDistribution {
  range: string;                // e.g. "0-30s", "30-60s"
  count: number;
  percentage: number;
}[]
```

---

## 八、系统与通用 `/system`

### 8.1 健康检查

`GET /health`

**响应：**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "redis": "ok",
    "volcano_api": "ok"
  }
}
```

### 8.2 文件上传（通用）

`POST /upload`

Content-Type: `multipart/form-data`

用于非素材类文件上传（如商品图片临时上传）。

**响应：**

```typescript
interface UploadResponse {
  url: string;
  filename: string;
  size: number;
}
```

---

## 九、WebSocket 事件（Socket.IO）

连接地址：`ws://localhost:3000`

Namespace: `/tasks`

### 客户端 → 服务端

| 事件 | 数据 | 说明 |
|------|------|------|
| `subscribe` | `{ task_id: string }` | 订阅任务进度 |
| `unsubscribe` | `{ task_id: string }` | 取消订阅 |

### 服务端 → 客户端

| 事件 | 数据 | 说明 |
|------|------|------|
| `task:progress` | `{ task_id, progress }` | 进度更新 |
| `task:completed` | `{ task_id, result }` | 任务完成 |
| `task:failed` | `{ task_id, error }` | 任务失败 |
| `material:analyzed` | `{ material_id, ai_tags, ai_description }` | 素材打标完成 |
| `script:generated` | `{ script_id }` | 批量剧本生成完成 |

### 进度推送示例

```json
{
  "task_id": "task_abc123",
  "progress": {
    "current_step": 2,
    "total_steps": 5,
    "step_name": "generating_scenes",
    "percentage": 40,
    "message": "正在生成第 2 个分镜视频...",
    "estimated_remaining": 45
  }
}
```

---

## 十、接口调用流程示例

### 完整一键成片流程

```
1. POST /materials/upload          → 上传商品素材
2. [等待] material:analyzed 事件    → 素材 AI 打标完成
3. POST /scripts/generate          → 生成剧本
4. GET  /scripts/:id               → 查看剧本
5. PUT  /scripts/:id/scenes/:sid   → 编辑分镜（可选）
6. POST /scripts/:id/confirm       → 确认剧本
7. POST /generation/create         → 提交生成任务
8. [订阅] task:progress            → 实时进度
9. [等待] task:completed           → 生成完成
10. POST /generation/tasks/:id/export → 导出视频
```

### 快速成片流程

```
1. POST /generation/quick          → 一步到位
2. [订阅] task:progress            → 实时进度
3. [等待] task:completed           → 生成完成
```
## 2026-06-06 轻量级带货模板市场接口补充

以下接口均带 `/api/v1` 全局前缀。模板接口保留原 `/templates`，并新增 `/inspiration-templates` 作为演示友好别名。

### 获取模板列表

`GET /templates`

可选查询参数：`page`、`pageSize`、`keyword`、`category`、`status`。`status` 可为 `enabled` 或 `disabled`。

### 使用模板生成带货视频方案

`POST /templates/:id/generate`

请求体：

```json
{
  "productName": "草莓夹心饼干",
  "category": "食品",
  "sellingPoints": "酥脆、草莓味浓、独立包装、适合追剧",
  "price": "19.9元",
  "targetUser": "学生和上班族",
  "promotion": "第二件半价",
  "duration": "30秒",
  "style": "开箱种草"
}
```

响应体：

```typescript
interface TemplateGenerateResult {
  title: string;
  script: string;
  storyboard: {
    shot: number;
    content: string;
    videoPrompt: string;
  }[];
  publishCopy: string;
  tags: string[];
}
```

### 保存到我的作品

`POST /my-videos`

请求体：

```typescript
interface SaveMyVideoRequest {
  template_id: string;
  template_name: string;
  product_info: TemplateGenerateRequest;
  result: TemplateGenerateResult;
}
```

### 查看我的作品

`GET /my-videos`

返回用户保存的模板生成结果列表，字段包含 `product_name`、`template_name`、`status`、`created_at` 和完整 `result`。
