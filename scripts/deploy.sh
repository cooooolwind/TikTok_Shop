#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ECS 一键部署脚本 (阿里云 ACR)
# 用法: ./scripts/deploy.sh [backend|frontend|all|status]
#
# 环境变量:
#   ACR_REGISTRY    阿里云 ACR 地址 (默认 registry.cn-shanghai.aliyuncs.com)
#   ACR_NAMESPACE   ACR 命名空间
#   ACR_AK          RAM AccessKey ID
#   ACR_SK          RAM AccessKey Secret
# ============================================================

DEPLOY_DIR="/opt/aigc-platform"
ACR_REGISTRY="${ACR_REGISTRY:-registry.cn-shanghai.aliyuncs.com}"
ACR_NAMESPACE="${ACR_NAMESPACE:-your-namespace}"

BACKEND_IMAGE="$ACR_REGISTRY/$ACR_NAMESPACE/aigc-backend:latest"
FRONTEND_IMAGE="$ACR_REGISTRY/$ACR_NAMESPACE/aigc-frontend:latest"

COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

log_info()  { echo -e "${COLOR_GREEN}[INFO]${COLOR_RESET} $*"; }
log_error() { echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $*"; }

check_prerequisites() {
  for cmd in docker curl; do
    if ! command -v "$cmd" &>/dev/null; then
      log_error "$cmd not installed"
      exit 1
    fi
  done

  if ! docker compose version &>/dev/null; then
    log_error "Docker Compose plugin not installed"
    exit 1
  fi

  if [ ! -f "$DEPLOY_DIR/.env" ]; then
    log_error ".env file not found at $DEPLOY_DIR/.env"
    exit 1
  fi
}

acr_login() {
  if [ -z "${ACR_AK:-}" ] || [ -z "${ACR_SK:-}" ]; then
    log_info "ACR_AK / ACR_SK not set, skipping docker login"
    return
  fi
  log_info "Logging into ACR: $ACR_REGISTRY"
  echo "$ACR_SK" | docker login "$ACR_REGISTRY" -u "$ACR_AK" --password-stdin
}

pull_images() {
  log_info "Pulling images from $ACR_REGISTRY/$ACR_NAMESPACE ..."
  cd "$DEPLOY_DIR"

  export BACKEND_IMAGE FRONTEND_IMAGE
  docker compose -f docker-compose.prod.yml pull backend frontend
}

start_services() {
  log_info "Starting all services..."
  cd "$DEPLOY_DIR"
  export BACKEND_IMAGE FRONTEND_IMAGE
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
}

health_check() {
  log_info "Running health checks..."
  sleep 3

  if curl -sf http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    log_info "Backend: OK"
  else
    log_error "Backend: FAILED"
  fi

  if curl -sf http://localhost/ > /dev/null 2>&1; then
    log_info "Frontend: OK"
  else
    log_error "Frontend: FAILED"
  fi
}

cleanup_images() {
  log_info "Cleaning up unused images..."
  docker image prune -af --filter "until=24h"
}

show_status() {
  log_info "Container status:"
  export BACKEND_IMAGE FRONTEND_IMAGE
  docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" ps
}

# --- Main ---
SERVICE="${1:-all}"

check_prerequisites
acr_login

case "$SERVICE" in
  backend)
    pull_images
    export BACKEND_IMAGE FRONTEND_IMAGE=""
    docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" up -d --no-deps backend
    ;;
  frontend)
    pull_images
    export FRONTEND_IMAGE BACKEND_IMAGE=""
    docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" up -d --no-deps frontend
    ;;
  all)
    pull_images
    start_services
    ;;
  status)
    show_status
    exit 0
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all|status]"
    exit 1
    ;;
esac

health_check
cleanup_images
log_info "Deploy complete!"
