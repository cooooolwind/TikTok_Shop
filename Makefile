.PHONY: dev build test lint typecheck clean docker-up docker-down db-migrate db-seed

# 开发环境一键启动
dev:
	pnpm install
	docker compose -f docker-compose.dev.yml up -d postgres redis
	pnpm dev

# 构建所有包
build:
	pnpm install
	pnpm build

# 运行测试
test:
	pnpm test

# 代码检查
lint:
	pnpm lint

# 类型检查
typecheck:
	pnpm typecheck

# 清理构建产物
clean:
	pnpm clean
	find . -name "node_modules" -type d -prune -exec rm -rf {} +
	find . -name "dist" -type d -prune -exec rm -rf {} +

# Docker 启动/停止
docker-up:
	docker compose up -d

docker-down:
	docker compose down

# 数据库迁移
db-migrate:
	pnpm --filter @aigc/backend typeorm migration:run

# 开发数据填充
db-seed:
	pnpm --filter @aigc/backend ts-node scripts/seed-db.ts
