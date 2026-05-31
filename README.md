# TikTok_Shop AIGC 带货视频生成平台

> **一句话核心业务价值**：围绕 TikTok Shop 素材管理、脚本生成、视频创作和数据看板，搭建一套前后端分离的 AIGC 视频生产工作台，实现带货视频的自动化、规模化产出。

## 完赛项目基础信息

- **参赛课题**：TODO: 填写参赛课题
- **团队名称与成员名单**：TODO: 填写团队名称与成员名单
- **分工说明**：TODO: 填写分工说明（如小队完成，写清各模块负责人）
- **提效形式**：TODO: 填写提效形式

## 交付材料

- **在线 Demo 链接**：[Demo链接](http://115.29.186.188)
- **演示视频链接**：TODO: 填写演示视频链接（3-8 分钟）
- **源代码仓库链接**：TODO: 填写源代码仓库链接

## 功能说明

### 核心功能清单
1. **素材管理与理解**：支持本地文件上传、类型/状态筛选、分镜切片展示以及基于大模型的视频素材多模态分析打标。
2. **灵感模板与脚本工作台**：提供脚本库、灵感模板，支持 AI 一键生成带货脚本与结构化分镜。
3. **全链路自动生成**：对接火山引擎大模型与视频生成 API，支持异步队列处理，实现从脚本文案到最终成片的自动管线。
4. **任务监控与数据看板**：使用 WebSocket 实时推送任务进度，提供统一的数据可视化看板。
5. **分镜首帧视频生成与按需导出**：以每个分镜的 `visual_prompt` 为核心，先用 Seedream 根据商品图生成独立首帧，再将首帧作为 Seedance 视频任务的 `first_frame` 输入生成分镜片段；生成阶段默认保留分段预览，用户点击“导出完整视频”时再通过 FFmpeg 拼接完整 MP4。

### 端到端使用流程
TODO: 结合演示视频，用 5-8 句写清用户从进入系统到拿到结果的完整流程

## 技术说明

### 核心技术栈
- **前端**：React 18、Vite、Ant Design、Zustand、Socket.IO client、ECharts
- **后端**：NestJS、TypeORM、BullMQ、Socket.IO、Swagger
- **基础设施**：PostgreSQL 16 + pgvector、Redis、Docker Compose
- **工程化**：pnpm workspace、Turborepo、TypeScript、ESLint、Prettier

### 大模型 / AI 能力使用说明
- 接入了火山引擎 (Volcano Engine) 的 API 进行大语言模型对话 (ChatCompletion) 和视频生成。
- 使用大模型进行素材的多模态理解分析，并根据商品特征与灵感模板，自动输出 JSON Schema 格式的结构化视频脚本与分镜信息；剧本生成 Prompt 已强化为电商强转化导向，要求 3 秒 Hook、卖点分配、商品可见、购买理由和 CTA 收尾。
- 视频生成阶段采用“商品图参考 + Seedream 分镜首帧”策略：商品图只作为 Seedream 的参考输入，每个分镜必须先生成商品锚定首帧，再把 Seedream 首帧作为 Seedance `first_frame` 生成该分镜视频；本地上传商品图会在后端转为 data URL 后提交给 Seedream，首帧图片尺寸按 Seedream 最小像素要求使用 9:16 `1600x2848`、16:9 `2848x1600`、1:1 `1920x1920`；如果 Seedream 首帧生成失败，会使用简化提示词重试 Seedream，仍失败则明确提示用户补充/调整商品图或分镜提示词，不会把原始商品图直接传给视频模型，也不会退化为纯文本视频。

### 智能剪辑与视频合成
- 后端按分镜逐段生成视频，并为每个分镜单独生成商品锚定首帧；生成任务完成时只保存分段视频，默认预览第一段并保留分段切换入口。商品图是视频生成强约束：剧本生成页支持选择素材库图片或填写商品图 URL，并会写入剧本 `product_info.images`；剧本详情和一键出片页会展示商品图，若缺少商品图，前端会阻止提交，后端也会返回明确错误并提示先上传或填写商品图。
- 完整 MP4 只在用户点击“导出完整视频”时按需拼接，输出到 `packages/backend/uploads/generated/{taskId}.mp4`，并通过 `/uploads/generated/{taskId}.mp4` 提供访问；导出完成后不会跳转新页面，而是在分段列表末尾新增“完整视频”卡片供用户切换预览；如果 FFmpeg 拼接失败，任务状态和分段预览不受影响，页面会给出清晰导出失败提示。
- 后端 Docker 镜像已安装并校验 FFmpeg；本地裸机开发如需实际拼接，请确保运行后端的环境可访问 `ffmpeg` 命令。

### 关键工程难点与解决方案
- **长耗时 AI 任务的异步处理与反馈**：AI 视频生成耗时极长，传统 HTTP 阻塞极易超时。解决方案：引入 Redis + BullMQ 搭建异步任务队列池，采用 NestJS Gateway (Socket.IO) 向前端客户端主动推送进度事件，保证用户体验的流畅性。
- **全栈项目的类型规约与开发效率**：前后端分离项目易出现接口不对齐导致的问题。解决方案：利用 pnpm workspace 构建 Monorepo，提取统一的 `packages/shared-types` 契约层；配合 Turborepo 实现了全项目的秒级增量类型检查与构建。

### 部署与访问说明
TODO: 说明项目部署在哪里、如何访问、评委如何快速体验

## 结果说明

- **项目完成度**：目前已处于 **核心 MVP 阶段**（已打通 80% 核心链路任务）。工程基础设施、异步任务调度、WebSocket 实时推送以及“素材 → 剧本 → 创作”核心链路已完全闭环。详细进度见 `AGENTS/PROJECT_PROGRESS.md`。
- **项目亮点 / 创新点**：
  1. **极致移动端适配**：针对移动端商家场景，重构了侧边栏为“宫格悬浮菜单”，并对所有管理列表实施了 Table-to-Card 转换与无限滚动支持，确保在手机上也能流畅进行分镜编辑与素材管理。
  2. **分镜级异步生成与断点重试**：采用分镜优先 Prompt 策略，极大降低了长视频生成的失败率；利用 BullMQ 实现分镜级任务调度，支持在单个分镜生成失败后，仅对失败分镜进行 Prompt 调整并一键断点续传。
  3. **视觉连续性算法**：在分镜化生成的管线中，自动提取上一分镜的尾帧作为下一分镜的首帧参考，解决了 AI 视频片段拼接时的画面跳跃问题，提升了最终成片的连贯性。

---

## 运行说明 (README)

### 仓库结构

```text
TikTok_Shop/
├── packages/
│   ├── frontend/       # React + Vite 前端应用
│   ├── backend/        # NestJS 后端服务
│   └── shared-types/   # 前后端共享 TypeScript 类型
├── docker/             # Dockerfile、Nginx、PostgreSQL 初始化脚本
├── AGENTS/             # 架构、API、进度跟踪及 AI Agent 提示词说明
├── docker-compose.yml
├── docker-compose.dev.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### 本地开发环境

#### 环境要求

- Node.js == 22
- pnpm >= 8
- Docker / Docker Compose

#### 启动步骤

1. 复制环境变量模板。
   ```bash
   cp .env.example .env
   ```
2. 安装依赖。
   ```bash
   pnpm install
   ```
3. 启动开发环境数据库和 Redis。
   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres redis
   ```
4. 启动前后端开发服务。
   ```bash
   pnpm dev
   ```
也可以使用 Makefile 一键启动：`make dev`

### 访问地址

| 服务 | 地址 |
| --- | --- |
| 前端应用 | http://localhost:5173 |
| 后端 API | http://localhost:3000/api/v1 |
| Swagger 文档 | http://localhost:3000/api/docs |
| 本地上传文件 | http://localhost:3000/uploads |
| WebSocket | `/tasks` |

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 通过 Turborepo 并行启动开发服务 |
| `pnpm build` | 构建所有 workspace package |
| `pnpm lint` | 运行 ESLint |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm test` | 运行测试 |

### Docker 生产部署

生产/集成环境可以使用完整 Docker Compose 编排：

1. 配置 `.env`。
2. 启动服务：`docker compose up -d`
3. 访问前端：`http://localhost`

完整 Docker 编排包含 PostgreSQL、Redis、backend 和 frontend。frontend 镜像内置 Nginx，负责托管前端静态资源，并反向代理 `/api/` 与 `/socket.io/` 到后端服务。backend 使用 `backend_uploads` volume 持久化 `/app/uploads`。

### 核心环境变量 (.env)

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL 账号和数据库 |
| `VOLCANO_API_KEY` | 火山引擎 API Key，不要提交真实 Key |
| `VOLCANO_IMAGE_API_KEY` / `VOLCANO_IMAGE_ENDPOINT` / `VOLCANO_IMAGE_BASE_URL` | Seedream 首帧生成配置；未单独配置时 API Key/Base URL 可复用 `VOLCANO_API_KEY` / `VOLCANO_BASE_URL` |
| `MOCK_MODE` | 开发阶段可设置为 `true` |
| `JWT_SECRET` | JWT 密钥，生产环境必须替换 |
| `UPLOAD_DIR` | 本地上传目录；相对路径会按 `packages/backend` 解析，默认 `./uploads` 即 `packages/backend/uploads` |

### CI 流程

GitHub Actions 会在 push/PR 到 `main` 时运行：lint、typecheck、backend test、frontend test、build和deploy（到阿里云服务器）
