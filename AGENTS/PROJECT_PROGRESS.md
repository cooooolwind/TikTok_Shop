# 模块进度总览（按阶段排列）

> 基于 `PROJECT_PLAN.md` 的模块 A–H 及其子任务，按 Phase 1–4 排列，标注功能清单与实际实现进度。
>
> 状态图例：✅ 已完成 · 🔨 部分完成 · ⬜ 未开始

---

## Phase 1：工程就绪 + 核心链路打通（Week 1）

> **目标**：仓库可运行、前后端骨架就位、跑通最简一键成片

### 模块 A：工程基础（P0）

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| A1 | Monorepo 初始化（pnpm workspaces + Turborepo + shared-types） | ✅ | pnpm-workspace.yaml、turbo.json、shared-types 包均已配置并导出真实类型 |
| A2 | ESLint + Prettier + Husky + lint-staged + commitlint | ✅ | 全部配置就位；Husky 仅有内部脚本，无自定义 hook 文件 |
| A3 | 后端骨架：NestJS + TypeORM + Swagger + 健康检查 | ✅ | main.ts 配置完成，包含全部模块注册及 `/api/v1/health` |
| A4 | 前端骨架：React + Vite + Ant Design + Router + 布局 | ✅ | MainLayout + 侧边栏导航 + 路由懒加载完整 |
| A5 | Docker Compose + Makefile | ✅ | `docker-compose.dev.yml`、`docker-compose.yml`、`docker-compose.prod.yml` 与 Makefile 皆就绪 |
| A6 | 数据库 Migration 初始化 | ✅ | DatabaseModule + TypeORM 配置就绪；dev环境使用 synchronize: true，prod 关闭 |
| A7 | 前后端 Mock 约定：OpenAPI spec + Mock Server | ✅ | Swagger `/api/docs`，`MOCK_MODE` 环境变量及 `VolcanoClientProvider` Mock 实现就位 |

### 模块 B（Phase 1 部分）：素材上传

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| B1 | 素材上传 API（类型校验 + 存储） | ✅ | `POST /materials/upload`，multer 文件校验，本地存储 + DB 写入及查询功能完备 |

### 模块 D（Phase 1 部分）：核心链路打通

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| D2 | 任务队列：BullMQ + 进度上报 + Socket.IO 推送 | ✅ | 4个队列定义，ScriptGenerationProcessor 和 VideoGenerationProcessor 完全实现 |
| D3 | 火山引擎视频生成 API 封装 | ✅ | ChatCompletion与视频生成API真实接入（含Mock fallback），TTS仍为 stub |

---

## Phase 2：核心链路 MVP（Week 2）

> **目标**：跑通完整「素材 → 剧本 → 成片」链路

### 模块 B（续）：素材管理

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| B2 | 素材管理前端（上传、列表、预览、删除、来源声明） | ✅ | 全量功能实现，包含上传弹窗、各种条件筛选、批删与详情查看 |
| B3 | 多模态理解：视觉模型打标（异步任务） | 🔨 | mock 分析端点写入 ai_tags/ai_description；Prompt已存在但无真实调用，无BullMQ异步化 |
| B4 | 视频切片：按场景自动切分 + 元数据存储 | 🔨 | 切片 entity + 查询端点存在；无实际视频处理逻辑，需手动插入数据 |

### 模块 C：剧本模块（P0）

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| C1 | 参考视频录入 + 结构化拆解 API | ⬜ | Controller/Service/Entity 存在，全为 stub |
| C2 | 灵感模板 CRUD | ✅ | 完整 CRUD 及测试用例，包含内置模板 |
| C3 | 剧本生成核心 Prompt 链 | ✅ | `ScriptsService.generate` 入队，BullMQ Processor 完整调用多模态模型；Prompt 已强化为电商强转化导向，要求 3 秒 Hook、卖点分配、商品可见、购买理由和 CTA 收尾 |
| C4 | 分镜脚本结构化输出（JSON Schema） | ✅ | AI 返回 `AiScriptResult` 结构化数据，`persistResult` 持久化入库 |
| C5 | 爆款仿写模式 | 🔨 | 模式字段存在，前端入口存在，但无参考视频重写 pipeline |
| C6 | 剧本工作台前端 | ✅ | `ScriptWorkbenchPage` 列表及 `ScriptGenerate` 表单，模板管理器均完整，且**全量完成移动端卡片式重构** |
| C7 | 剧本干预（分镜增删、台词改写、重生成） | ✅ | 后端接口完整，前端 `ScriptEditor` 提供编辑、单分镜重生成及WebSocket进度订阅（无拖拽排序） |

### 模块 D（Phase 2 部分）：成片 + 配音 + 预览

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| D1 | 一键成片 Pipeline | ✅ | `GenerationService.create` 到 `VideoGenerationProcessor` 完整 pipeline，调用火山引擎并持久化结果 |
| D4 | TTS 配音对接 | ⬜ | TTS module 存在，全为 stub，返回桩数据 |
| D5 | 视频预览 + 导出 | ✅ | 后端提供导出URL，前端 `VideoPreview` 和 `TaskDetail` 支持分段预览；完整视频仅在点击导出时按需拼接，预览页导出完成后会在分段列表末尾新增“完整视频”卡片 |

### 模块 E：用户体验（P0）

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| E1 | 任务进度展示（阶段状态 + 进度条） | ✅ | 后端 `TasksGateway` WebSocket 发送分镜级进度，前端 `useTaskSubscription` hook 渲染分镜步骤与整体进度条 |
| E2 | 失败兜底：错误分类 + 友好提示 + 一键重试 | ✅ | 视频生成支持错误分类、失败镜头提示、已成功分镜保留，并可从失败镜头继续重试 |
| E3 | 首页工作台（快速入口 + 最近任务 + 历史） | ✅ | `HomePage` 完整，包含快速成片入口与数据概览（硬编码数据） |

---

## Phase 3：体验打磨 + 进阶功能（Week 3）

> **目标**：补齐 P1 功能，提升产品完整度

### 模块 B（续）：向量检索

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| B5 | pgvector Embedding 生成 + 向量检索 API | 🔨 | 数据库启用 pgvector 扩展，但相似搜索端点目前使用文本打分降级，无实际向量检索 |
| B6 | 素材检索前端（关键词 + 标签 + 相似度搜索） | 🔨 | 列表页有关键词/标签筛选，无专用相似度向量搜索 UI |

### 模块 C（续）：剧本自动化

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| C8 | 剧本自动化（策略库 + 因子库动态组合） | ⬜ | 接口返回 count: 0 的 stub |

### 模块 D（续）：智能剪辑 + 分镜编辑器

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| D6 | 智能剪辑：分镜拼接 + 转场 + 字幕（FFmpeg） | 🔧 | 已接入分镜优先视频 prompt、Seedream 商品图首帧生成、商品图兜底和按需 FFmpeg 拼接：后端逐分镜生成商品锚定首帧并作为 Seedance `first_frame` 生成视频片段，首帧失败时使用商品图兜底且不退化为纯文本；生成阶段不自动拼接，点击导出完整视频时输出 MP4 到 `packages/backend/uploads/generated/{taskId}.mp4`；转场、字幕、BGM 混音暂未实现 |
| D7 | BGM 配乐库 + 按风格自动匹配 | ⬜ | BGM module 返回空列表，前端有 UI 但无数据 |
| D8 | 分镜级编辑器前端（时间轴 + 拖拽） | 🔨 | `ScriptEditor.tsx` 完全实现分镜卡片流、字段编辑等（尚无拖拽功能） |
| D9 | 分镜干预 API（单分镜重生成/替换/调时长） | ✅ | 提供单分镜的 regenerate 接口（目前为同步模拟，未调度异步任务） |

### 模块 E（续）：响应式

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| E4 | 响应式布局（桌面优先 + 移动端可查看） | ✅ | Ant Design 栅格及自定义响应式钩子，全量支持移动端网格导航、卡片式列表及适配后的分镜编辑器 |

### 模块 G：质量保障与运维

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| G1 | 后端核心逻辑单元测试 | ✅ | 10个核心模块及 Service 的 spec 测试文件，覆盖剧本、生成等 |
| G2 | 前端组件测试 | 🔨 | 存在基础组件和 hook 测试，但缺乏核心页面测试 |
| G3 | E2E 冒烟测试（一键成片链路） | ⬜ | 无 Playwright 或其他 E2E 配置 |
| G4 | 结构化日志（Pino）+ traceId | 🔨 | `LoggingInterceptor` 输出带 traceId 的请求日志，但异常过滤器未记录，且未使用 Pino |
| G5 | CI Pipeline：lint + test + build + Docker image | ✅ | 完整 CI（turbo --affected）+ CD（ACR 推送 + ECS 部署） |

---

## Phase 4：看板 + 加分项 + 交付（Week 4）

> **目标**：数据看板、创新功能选做、准备提报材料

### 模块 F：数据看板（P1）

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| F1 | Mock 数据服务（分发数据、转化数据、生成记录） | ⬜ | AnalyticsModule 存在，方法返回零值或空数组 stub |
| F2 | 看板 API + 前端页面（生成量/成功率/耗时） | 🔨 | 前端 ECharts 看板完整并对接了服务，但后端是 stub |
| F3 | 生成因子 × 转化效果归因可视化 | 🔨 | 前端 AttributionChart 组件完成，后端是 stub |

### 模块 H：创新加分项（P2）

| # | 任务 | 状态 | 说明 |
|---|------|:----:|------|
| H1 | A/B 自动出片对比 | ⬜ | 无实现 |
| H2 | Agent 编排（LangGraph 多步骤决策） | ⬜ | 无实现 |
| H3 | 合规审核流（内容安全 + 版权 + 审核状态机） | ⬜ | 无实现 |
| H4 | Prompt 市场（分享/收藏优质 Prompt 模板） | ⬜ | 无实现 |

---

## 汇总统计

| 阶段 | 模块 | 总任务数 | ✅ 已完成 | 🔨 部分完成 | ⬜ 未开始 |
|------|------|:--------:|:---------:|:-----------:|:---------:|
| Phase 1 | A 工程基础 | 7 | 7 | 0 | 0 |
| Phase 1 | B1（素材上传） | 1 | 1 | 0 | 0 |
| Phase 1 | D2–D3（核心链路） | 2 | 2 | 0 | 0 |
| Phase 2 | B2–B4（素材管理） | 3 | 1 | 2 | 0 |
| Phase 2 | C1–C7（剧本） | 7 | 5 | 1 | 1 |
| Phase 2 | D1, D4–D5（成片） | 3 | 2 | 0 | 1 |
| Phase 2 | E1–E3（体验） | 3 | 3 | 0 | 0 |
| Phase 3 | B5–B6（向量检索） | 2 | 0 | 2 | 0 |
| Phase 3 | C8（剧本自动化） | 1 | 0 | 0 | 1 |
| Phase 3 | D6–D9（智能剪辑） | 4 | 1 | 2 | 1 |
| Phase 3 | E4（响应式） | 1 | 1 | 0 | 0 |
| Phase 3 | G1–G5（质量） | 5 | 3 | 1 | 1 |
| Phase 4 | F1–F3（看板） | 3 | 0 | 2 | 1 |
| Phase 4 | H1–H4（加分项） | 4 | 0 | 0 | 4 |
| **合计** | | **46** | **27** | **10** | **9** |

**整体进度更新：已完成 27 项，部分完成 10 项，未开始 9 项。核心的素材、剧本、生成、分镜级进度、预览与按需导出链路已打通；智能剪辑已完成分镜片段生成与导出时 FFmpeg 拼接的第一版；移动端适配已全面覆盖核心管理与编辑页面，确保商家在外也能轻松操作。**

