# 电商场景 AIGC 带货视频生成系统 — 架构文档

## 项目概述

本项目是一个面向 TikTok Shop 商家的 **端到端 AIGC 带货视频生成平台**，核心链路为：素材库建设 → 剧本生成 → 视频创作。商家可通过输入商品链接/图片，自动生成一条 15 秒以内的带货视频。

- **项目名称**：`aigc-video-platform`
- **技术边界**：React 18 + NestJS (Node.js) + TypeScript 全栈
- **AI 引擎**：火山引擎 OpenAPI
- **包管理器**：pnpm 8（workspace monorepo）
- **构建工具**：Turborepo

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                       Nginx (:80)                        │
│  静态资源服务 + API/WebSocket 反向代理                     │
├─────────────────────────────────────────────────────────┤
│  Frontend (React 18 + Vite + Ant Design 5)              │
│  SPA 应用，开发端口 5173，生产环境由 Nginx 托管             │
├─────────────────────────────────────────────────────────┤
│  Backend (NestJS + TypeScript)                          │
│  RESTful API (:3000 /api/v1) + WebSocket (Socket.IO)    │
│  ├─ 业务模块层 (modules/)                                │
│  │  素材 → 参考 → 模板 → 剧本 → 创作 (TTS/BGM) → 看板     │
│  ├─ AI 层 (ai/)                                          │
│  │  火山引擎 SDK 封装 + Prompt 模板                       │
│  ├─ 任务队列 (tasks/)                                    │
│  │  BullMQ + Redis，异步执行视频生成等长任务               │
│  └─ WebSocket (websocket/)                              │
│      实时推送任务进度、素材分析结果等                      │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                          │
│  ├─ PostgreSQL 16 (pgvector) — 结构化数据 + 向量检索      │
│  └─ Redis 7 — 任务队列 + 缓存 + Session                  │
└─────────────────────────────────────────────────────────┘
```

### 技术栈一览

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript + Vite | SPA 应用 |
| UI 组件库 | Ant Design 5 | 后台类页面 |
| 状态管理 | Zustand | 轻量状态管理 |
| 图表 | ECharts (echarts-for-react) | 数据看板可视化 |
| 后端框架 | NestJS + TypeScript | 模块化、依赖注入 |
| ORM | TypeORM | 数据库操作 |
| 任务队列 | BullMQ + Redis | 异步长任务 |
| 实时通信 | Socket.IO | 任务进度实时推送 |
| 数据库 | PostgreSQL 16 + pgvector | 结构化存储 + 向量检索 |
| AI 接口 | 火山引擎 OpenAPI | 大模型/视频生成 |
| 容器化 | Docker + Docker Compose | 一键部署 |
| 文档 | Swagger (NestJS) | 自动生成 API 文档 |

---

## 项目目录结构

```
TikTok_Shop/
├── .github/workflows/         # GitHub Actions CI/CD 配置
├── docker/                    # Docker 相关文件
│   ├── backend.Dockerfile     # 后端镜像
│   ├── frontend.Dockerfile    # 前端镜像（含 Nginx）
│   ├── nginx.conf             # Nginx 配置文件
│   └── postgres/init.sql      # 数据库初始化脚本
├── packages/                  # 核心代码（monorepo 子包）
│   ├── backend/               # 后端服务 (NestJS)
│   ├── frontend/              # 前端应用 (React + Vite)
│   └── shared-types/          # 前后端共享类型定义
├── .commitlintrc.js           # Commitlint 配置（约定式提交）
├── .editorconfig              # 编辑器配置
├── .env.example               # 环境变量模板
├── .eslintrc.cjs              # ESLint 配置
├── .npmrc                     # npm 配置
├── .prettierrc                # Prettier 代码格式化配置
├── API_SPEC.md                # API 接口规范文档
├── ARCHITECTURE.md            # 本文件：架构文档
├── docker-compose.yml         # 生产环境 Docker Compose 编排
├── docker-compose.dev.yml     # 开发环境 Docker Compose 编排（仅 DB/Redis）
├── Makefile                   # 常用命令快捷入口
├── package.json               # 根 package.json（monorepo 脚本）
├── pnpm-workspace.yaml        # pnpm workspace 配置
├── turbo.json                 # Turborepo 构建流水线配置
├── tsconfig.base.json         # 共享 TypeScript 配置
├── vitest.workspace.ts        # Vitest workspace 配置
└── 项目实施计划.md            # 项目实施计划文档
```

---

## 后端：`packages/backend/`（NestJS）

### 目录结构

```
packages/backend/
├── src/
│   ├── main.ts                # 应用入口，启动 HTTP 服务
│   ├── app.module.ts          # 根模块，注册所有子模块
│   ├── config/                # 全局配置（env、数据库、Redis 等）
│   │   └── config.module.ts   # ConfigModule 配置选项
│   ├── database/              # 数据库 DataSource、Entity、Migration
│   ├── common/                # 通用模块（跨业务复用）
│   │   ├── decorators/        # 自定义装饰器
│   │   ├── dto/               # 通用 DTO
│   │   ├── filters/           # 全局异常过滤器
│   │   ├── guards/            # 守卫（认证/授权）
│   │   ├── interceptors/      # 拦截器（日志/转换）
│   │   └── utils/             # 工具函数
│   ├── modules/               # 业务模块（核心领域逻辑）
│   │   ├── materials/         # 素材管理：上传、分类、检索
│   │   ├── references/        # 参考视频：分析、分镜拆解
│   │   ├── templates/         # 模板管理：视频模板 CRUD
│   │   ├── scripts/           # 脚本/剧本：AI 生成、编辑、场景管理
│   │   ├── generation/        # 视频创作：任务创建、进度追踪、导出
│   │   ├── tts/               # 语音合成：TTS 音色列表、预览
│   │   ├── bgm/               # 背景音乐：BGM 列表管理
│   │   ├── analytics/         # 数据看板：概览、趋势、归因分析
│   │   └── system/            # 系统模块：健康检查、文件上传
│   ├── ai/                    # AI 层
│   │   ├── providers/         # AI 提供商封装（火山引擎 SDK）
│   │   └── prompts/           # Prompt 模板管理
│   ├── tasks/                 # 任务队列
│   │   └── processors/        # BullMQ 任务处理器（视频生成等）
│   └── websocket/             # WebSocket 网关（实时推送）
├── package.json               # 后端依赖声明
├── nest-cli.json              # NestJS CLI 配置
├── jest.config.ts             # 测试配置
├── tsconfig.json              # TypeScript 配置
└── tsconfig.build.json        # 构建配置
```

### 关键依赖

| 包名 | 用途 |
|------|------|
| `@nestjs/core` | NestJS 核心框架 |
| `@nestjs/typeorm` + `typeorm` + `pg` | 数据库 ORM + PostgreSQL 驱动 |
| `@nestjs/bullmq` + `bullmq` + `ioredis` | 任务队列 + Redis 连接 |
| `@nestjs/platform-socket.io` + `socket.io` | WebSocket 实时通信 |
| `@nestjs/swagger` | Swagger API 文档自动生成 |
| `@nestjs/throttler` | 请求速率限制 |
| `@nestjs/config` | 环境变量管理 |
| `class-validator` + `class-transformer` | DTO 校验与转换 |
| `multer` | 文件上传 |

### API 设计

- 全局路径前缀：`/api/v1`
- API 文档：`http://localhost:3000/api/docs`（Swagger UI）
- 认证方式：Bearer Token
- 响应格式：统一 `{ code, data, message }` 结构
- 详细接口规范见 `API_SPEC.md`

---

## 前端：`packages/frontend/`（React + Vite）

### 目录结构

```
packages/frontend/
├── src/
│   ├── main.tsx               # 应用入口
│   ├── App.tsx                # 根组件（挂载 Router）
│   ├── layouts/               # 布局组件
│   │   └── MainLayout.tsx     # 主布局（侧边导航 + 内容区）
│   ├── pages/                 # 页面组件
│   │   ├── Home/              # 首页 / 仪表盘
│   │   ├── MaterialManagement/# 素材管理页
│   │   ├── ScriptWorkbench/   # 脚本工作台页
│   │   ├── CreationStudio/    # 创作工作室页
│   │   └── AnalyticsDashboard/# 数据看板页
│   ├── router/                # 前端路由
│   │   └── index.tsx          # React Router 路由配置（懒加载）
│   ├── services/              # API 请求层（Axios 封装）
│   ├── stores/                # 状态管理（Zustand stores）
│   ├── styles/                # 全局样式
│   └── utils/                 # 工具函数
├── index.html                 # HTML 入口
├── vite.config.ts             # Vite 构建配置
├── package.json               # 前端依赖声明
├── tsconfig.json              # TypeScript 配置
└── tsconfig.node.json         # Vite Node 端 TS 配置
```

### 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 首页，项目总览与快速入口 |
| `/materials` | MaterialManagementPage | 素材管理：上传、浏览、搜索 |
| `/scripts` | ScriptWorkbenchPage | 脚本工作台：AI 生成与编辑 |
| `/scripts/:id` | ScriptWorkbenchPage | 单个脚本详情编辑 |
| `/creation` | CreationStudioPage | 创作工作室：视频生成 |
| `/creation/tasks/:taskId` | CreationStudioPage | 单个创作任务详情 |
| `/analytics` | AnalyticsDashboardPage | 数据看板：统计分析 |

### 关键依赖

| 关键依赖 | 用途 |
|------|------|
| `react` + `react-dom` | UI 框架 |
| `react-router-dom` | 前端路由（懒加载） |
| `antd` + `@ant-design/icons` | UI 组件库 |
| `zustand` | 轻量状态管理 |
| `axios` | HTTP 请求 |
| `echarts` + `echarts-for-react` | 数据可视化图表 |
| `socket.io-client` | WebSocket 客户端（任务进度推送） |
| `vite` | 构建工具 |

### 响应式设计策略 (Mobile First & Adaptive)

系统采用 **Responsive (方案 B)** 策略，确保在不同终端下均有优秀体验：

1. **导航模式切换**：
   - **桌面端**：左侧常驻 `Sider` 菜单。
   - **移动端**：全屏网格菜单 (`Grid Overlay Menu`)，带模糊背景与入场动画，点击汉堡按钮触发。
2. **列表重构 (Table-to-Card)**：
   - 剧本列表、参考库等在 PC 端使用 `Table`，在移动端自动转换为 `Card List` 布局，彻底消除横向溢出。
3. **流式体验**：
   - 移动端列表启用 **无限滚动 (Infinite Scroll)** 加载，由 `IntersectionObserver` 驱动。
4. **适配断点**：
   - 统一使用 `768px` 作为主断点，配合 `useMediaQuery` Hook 进行逻辑与样式的动态切换。

---

## 共享类型：`packages/shared-types/`

前后端共享的 TypeScript 类型定义，确保接口契约一致性。

```
packages/shared-types/src/
├── index.ts         # 统一导出
├── common.ts        # 通用类型：ApiResponse、PaginatedResponse、PaginationQuery
├── errors.ts        # 错误码枚举
├── material.ts      # 素材相关类型
├── reference.ts     # 参考视频相关类型
├── template.ts      # 模板相关类型
├── script.ts        # 剧本相关类型
├── generation.ts    # 视频创作相关类型
├── tts.ts           # TTS 语音合成类型
├── bgm.ts           # BGM 背景音乐类型
├── analytics.ts     # 数据看板类型
├── system.ts        # 系统模块类型
└── websocket.ts     # WebSocket 事件与消息类型
```

---

## 基础设施

### 数据库：PostgreSQL 16 + pgvector

- 使用 `pgvector/pgvector:pg16` 镜像
- 支持向量检索，用于素材相似度搜索
- TypeORM 管理 Schema 和 Migration
- 初始化脚本：`docker/postgres/init.sql`

### 缓存/队列：Redis 7

- 使用 `redis:7-alpine` 镜像
- BullMQ 任务队列（视频生成等长耗时任务）
- 可选用于 Session 存储和缓存

### Docker 编排

| 文件 | 环境 | 包含服务 |
|------|------|----------|
| `docker-compose.dev.yml` | 开发 | postgres + redis（仅基础设施） |
| `docker-compose.yml` | 生产 | postgres + redis + backend + frontend（Nginx） |

生产环境中：
- Nginx 在前端容器中反向代理 `/api/` 到后端
- Nginx 同时代理 `/socket.io/` WebSocket 连接
- 后端依赖 postgres 和 redis 健康检查通过后才启动

---

## 开发工作流

### 环境变量

复制 `.env.example` 为 `.env`（或 `.env.local`），配置：
- 数据库连接信息
- Redis 连接信息
- 火山引擎 API Key
- `MOCK_MODE=true` 开发阶段可启用 Mock 模式

### 常用命令

```bash
# 开发环境一键启动（安装依赖 → 启动 DB/Redis → 启动前后端）
make dev

# 构建所有包
make build

# 运行测试
make test

# 代码检查 + 格式化
make lint

# Docker 生产方式
make docker-up       # 启动全部服务
make docker-down     # 停止全部服务
```

### Monorepo 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 并行启动前后端开发服务器 |
| `pnpm build` | 构建所有子包 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm test` | 运行测试 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm format` | Prettier 代码格式化 |

---

## 业务数据流

```
                           ┌──────────────┐
                           │  火山引擎 API │
                           │  (大模型/视频) │
                           └──────┬───────┘
                                  │
  用户 ──→ 前端 (React) ──→ 后端 API (NestJS) ──→ AI 模块 ──→ 任务队列 (BullMQ)
           │                         │                              │
           │                    Swagger 文档                   Redis 队列
           │                         │                              │
           └── WebSocket ◀──── 实时推送 ◀────── 任务完成/进度通知 ──┘
                                 │
                           ┌─────┴─────┐
                           │ PostgreSQL │
                           │ (pgvector) │
                           └───────────┘
```

1. **素材入库**：用户上传商品图片/视频 → 后端存储 → AI 分析 → 结构化写入 DB
2. **剧本生成**：用户输入商品信息/偏好 → 后端调用 AI → 生成分镜剧本 → 返回编辑
3. **视频创作**：用户提交创作任务 → 入队列 (BullMQ) → 异步执行 (TTS + 视频生成 + BGM 合成) → WebSocket 实时推送进度 → 完成/导出
4. **数据看板**：汇总素材量、生成量、成功率等指标 → ECharts 可视化

---

## 数据看板 Mock 逻辑说明 (Analytics Mock Logic)

为保证在开发和演示环境数据看板依然能够呈现自洽的图表，系统内置了 `AnalyticsMockGenerator`，基于数据库的真实数据记录来按比例生成 Mock 转化指标。
> **注意**：可通过环境变量 `MOCK_DASHBOARD=false` 关闭此逻辑，届时成本、转化、策略等外部指标将由 `MockProxyInterceptor` 代理至真实的 `STATISTIC_API_URL` 服务。

### 1. 成本计算 (Cost)
- `ChatTokens`: `剧本数量 * random(8000, 25000)`
- `SeedanceCalls` (视频片段): `成功视频数 * 平均分镜数(3~4)`
- `totalChatCost`: `(ChatTokens / 1,000,000) * 0.8` (以 Doubao-pro ¥0.8/1M tokens 计算)
- `totalSeedanceCost`: `SeedanceCalls * 0.3` (¥0.3/次调用)
- `totalSeedreamCost`: `SeedanceCalls * 0.2` (¥0.2/次调用)
- `totalCost`: 上述三项之和

### 2. 转化计算 (Conversion & ROI)
- **曝光量 (Exposure)**: `总视频数 * random(500, 5000)`
- **点击量 (Click)**: `曝光量 * random(0.02, 0.05)` (CTR 为 2% ~ 5%)
- **订单量 (Order)**: `点击量 * random(0.01, 0.03)` (CVR 为 1% ~ 3%)
- **GMV**: `订单量 * random(80, 300)` (客单价 80~300 元)
- **ROI**: `GMV / totalCost`

### 3. 漏斗计算 (Funnel)
- `曝光`: 100%
- `点击`: 曝光 * ~3.2%
- `深度观看`: 点击 * 30%~50%
- `下单`: 深度观看 * ~1.8%

### 4. 策略归因 (Strategy Attribution)
读取真实数据库中的模板因子 (Factors) 配置，并为每个出现过的因子分配 `0.5 ~ 0.95` 之间的随机“平均表现分”。A/B 测试、BGM、字幕策略等数据，均通过类似方式生成符合行业常见表现特征的固定区间随机分布。
