health_check() {
  log_info "Running health checks..."
  sleep 3

  # 从 .env 文件中提取端口和前缀，如果不存在则使用默认值
  # 注意：这里假设 .env 文件在 DEPLOY_DIR 中
  local HEALTH_PORT
  local HEALTH_PREFIX
  HEALTH_PORT=$(grep ^BACKEND_PORT "$DEPLOY_DIR/.env" | cut -d= -f2 || echo 3000)
  HEALTH_PREFIX=$(grep ^API_PREFIX "$DEPLOY_DIR/.env" | cut -d= -f2 || echo api/v1)
  HEALTH_PORT=${HEALTH_PORT:-3000}
  HEALTH_PREFIX=${HEALTH_PREFIX:-api/v1}

  if curl -sf "http://localhost:${HEALTH_PORT}/${HEALTH_PREFIX}/health" > /dev/null 2>&1; then
    log_info "Backend: OK (Port: ${HEALTH_PORT}, Prefix: ${HEALTH_PREFIX})"
  else
    log_error "Backend: FAILED (Port: ${HEALTH_PORT}, Prefix: ${HEALTH_PREFIX})"
  fi

  if curl -sf http://localhost/ > /dev/null 2>&1; then
    log_info "Frontend: OK"
  else
    log_error "Frontend: FAILED"
  fi
}
