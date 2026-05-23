# TikTok_Shop

TikTok Shop 场景的 AIGC 带货视频生成平台。项目围绕素材管理、脚本生成、视频创作和数据看板，搭建一套前后端分离的 AIGC 视频生产工作台。

> 当前项目仍处于原型阶段：工程结构、模块边界、共享类型、实体、路由、队列和 WebSocket 骨架已经建立；素材模块已完成基础闭环；脚本、创作、AI provider、认证授权和真实视频生成链路仍有大量 stub/TODO。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、Vite、Ant Design、Zustand、Socket.IO client |
| 后端 | NestJS、TypeORM、BullMQ、Socket.IO、Swagger |
| 基础设施 | PostgreSQL 16 + pgvector、Redis、Docker Compose |
| 工程化 | pnpm workspace、Turborepo、TypeScript、ESLint、Prettier |

## 仓库结构

```text
TikTok_Shop/
├── packages/
│   ├── frontend/       # React + Vite 前端应用
│   ├── backend/        # NestJS 后端服务
│   └── shared-types/   # 前后端共享 TypeScript 类型
├── docker/             # Dockerfile、Nginx、PostgreSQL 初始化脚本
├── read_notes/         # 架构、API、实施计划等说明文档
├── docker-compose.yml
├── docker-compose.dev.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 本地开发

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker / Docker Compose

### 启动步骤

1. 复制环境变量模板。

   ```bash
   cp .env.example .env
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
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

也可以使用 Makefile 一键启动：

```bash
make dev
```

## 访问地址

| 服务 | 地址 |
| --- | --- |
| 前端应用 | http://localhost:5173 |
| 后端 API | http://localhost:3000/api/v1 |
| Swagger 文档 | http://localhost:3000/api/docs |
| 本地上传文件 | http://localhost:3000/uploads |
| WebSocket namespace | `/tasks` |

开发环境下，Vite 会将 `/api` 和 `/socket.io` 代理到 `http://localhost:3000`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 通过 Turborepo 并行启动开发服务 |
| `pnpm build` | 构建所有 workspace package |
| `pnpm lint` | 运行 ESLint |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm test` | 运行测试 |
| `make dev` | 安装依赖、启动开发数据库/Redis、启动开发服务 |
| `make docker-up` | 使用 `docker-compose.yml` 启动完整 Docker 服务 |
| `make docker-down` | 停止完整 Docker 服务 |

按 package 运行命令示例：

```bash
pnpm --filter @aigc/backend test
pnpm --filter @aigc/backend test -- materials.service.spec.ts
pnpm --filter @aigc/frontend test
pnpm --filter @aigc/backend typecheck
pnpm --filter @aigc/frontend typecheck
```

## Docker 启动

生产/集成环境可以使用完整 Docker Compose 编排：

1. 配置 `.env`。

   ```bash
   cp .env.example .env
   ```

2. 启动服务。

   ```bash
   docker compose up -d
   ```

3. 访问前端。

   ```text
   http://localhost
   ```

完整 Docker 编排包含 PostgreSQL、Redis、backend 和 frontend。frontend 镜像内置 Nginx，负责托管前端静态资源，并反向代理 `/api/` 与 `/socket.io/` 到后端服务。backend 使用 `backend_uploads` volume 持久化 `/app/uploads`。

## 核心模块

### 前端

- `src/router`：React Router 路由配置，页面按路由懒加载。
- `src/pages`：素材管理、脚本工作台、创作工作室、数据看板等页面。
- `src/services`：Axios API client 和各业务 API 封装。
- `src/stores`：Zustand 状态管理。
- `src/hooks`：分页、媒体查询、WebSocket 订阅等复用逻辑。

### 后端

- `src/modules/materials`：素材上传、列表、详情、删除、批删、mock 分析、视频切片查询和文本相似搜索降级。
- `src/modules/references`：参考视频管理，目前仍是占位实现。
- `src/modules/templates`：脚本/创意模板管理，目前仍是占位实现。
- `src/modules/scripts`：脚本生成、编辑、分镜管理，目前仍是占位实现。
- `src/modules/generation`：视频生成任务、重试、取消、导出，目前仍是占位实现。
- `src/tasks`：BullMQ 队列注册和任务处理。
- `src/websocket`：任务进度、素材分析和生成结果实时推送。
- `src/ai`：AI provider 和 prompt 相关扩展点，目前仍未接入真实火山引擎调用。

### 共享类型

`packages/shared-types` 是前后端共享的类型契约中心。新增或调整 API 数据结构时，优先在这里维护类型，再同步后端返回结构和前端 service/store 使用方式。

## 素材模块状态

素材模块已完成基础闭环：

- `POST /api/v1/materials/upload`：本地文件上传并写入数据库。
- `GET /api/v1/materials`：分页列表，支持类型、分类、状态、关键词、标签过滤。
- `GET /api/v1/materials/:id`：详情查询，返回 shared-types 约定的 snake_case 字段。
- `DELETE /api/v1/materials/:id`：删除单个素材，并尝试删除本地文件。
- `DELETE /api/v1/materials/batch`：批量删除素材。
- `POST /api/v1/materials/:id/analyze`：mock 分析，写入 `ai_tags`、`ai_description`，并广播素材分析事件。
- `GET /api/v1/materials/:id/slices`：查询视频切片列表。
- `POST /api/v1/materials/search/similar`：基于文件名、标签和描述的文本匹配降级搜索。

当前素材模块仍未实现：

- 真实 AI 视觉分析。
- pgvector embedding 生成和向量相似度排序。
- 视频缩略图、视频元数据解析和自动切片。
- 对象存储或 CDN。

## 环境变量

主要配置位于 `.env.example`：

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_HOST` / `POSTGRES_PORT` | PostgreSQL 连接地址 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL 账号和数据库 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接地址 |
| `BACKEND_PORT` | 后端监听端口，默认 `3000` |
| `FRONTEND_PORT` | 前端开发端口，默认 `5173` |
| `VOLCANO_API_KEY` | 火山引擎 API Key，不要提交真实 Key |
| `MOCK_MODE` | 开发阶段可设置为 `true` |
| `JWT_SECRET` | JWT 密钥，生产环境必须替换 |
| `UPLOAD_DIR` | 本地上传目录，默认 `./uploads` |
| `MAX_FILE_SIZE_IMAGE` | 图片上传大小限制，默认 20MB |
| `MAX_FILE_SIZE_VIDEO` | 视频上传大小限制，默认 500MB |

## 当前完成度

已完成/已建立：

- pnpm workspace + Turborepo monorepo 工程结构。
- React 前端页面、路由、API service、Zustand store 骨架。
- NestJS 后端模块、controller、entity、配置、Swagger、全局校验骨架。
- TypeORM 实体设计，覆盖素材、参考视频、模板、脚本、分镜、生成任务和视频。
- 素材模块基础闭环和单元测试。
- BullMQ 队列注册和视频生成 processor 框架。
- Socket.IO `/tasks` namespace 和任务事件定义。
- Docker Compose 开发和完整服务编排。

待补齐：

- references、templates、scripts、generation 等多数后端业务 service 的真实 CRUD、查询、分页和状态流转。
- AI provider 与火山引擎真实接口集成。
- 认证/授权逻辑，目前 guard 中仍有 TODO。
- 视频生成链路中的素材匹配、TTS、视频生成、FFmpeg 合成、导出等真实实现。
- 文档和部分源码注释存在中文编码乱码，建议后续统一修复为 UTF-8。

## 验证状态

最近一次素材模块实现后的验证结果：

```bash
pnpm --filter @aigc/backend test -- materials.service.spec.ts
pnpm --filter @aigc/frontend typecheck
```

上述命令已通过。

```bash
pnpm --filter @aigc/backend typecheck
```

后端全量类型检查当前仍失败，失败原因来自其它模块既有 stub/未使用变量，不是素材模块新增错误。

## 开发注意事项

- API 返回结构需要和 `packages/shared-types`、前端 `services`、前端 `stores` 的预期保持一致。
- 开发环境 TypeORM `synchronize` 会自动同步 schema；生产环境应使用 migration。
- 后端 controller 路径会统一挂载到 `/api/v1` 下，例如 `@Controller('materials')` 对应 `/api/v1/materials`。
- 本地上传文件通过 `/uploads` 静态路径访问，素材文件实际保存到 `UPLOAD_DIR/materials`。
- WebSocket 任务事件统一使用 `packages/shared-types/src/websocket.ts` 中的事件常量和 payload 类型。
- 提交前建议运行 `pnpm lint`、`pnpm typecheck` 和相关测试；当前需先处理其它 stub 模块的未使用变量，后端全量 typecheck 才能通过。

## CI

GitHub Actions 会在 push/PR 到 `main` 时运行：

- lint
- typecheck
- backend test
- frontend test
- build
