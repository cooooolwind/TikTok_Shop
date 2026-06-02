_retry_curl() {
  local url="$1"
  local label="$2"
  local max_attempts=5
  local interval=5
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      return 0
    fi
    if [ $attempt -lt $max_attempts ]; then
      echo "  ${label} health check attempt ${attempt}/${max_attempts} failed, retrying in ${interval}s..."
      sleep $interval
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

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

  local backend_url="http://localhost:${HEALTH_PORT}/${HEALTH_PREFIX}/health"
  if _retry_curl "$backend_url" "Backend"; then
    log_info "Backend: OK (Port: ${HEALTH_PORT}, Prefix: ${HEALTH_PREFIX})"
  else
    log_error "Backend: FAILED (Port: ${HEALTH_PORT}, Prefix: ${HEALTH_PREFIX})"
    echo "--- Backend container logs (last 100 lines) ---"
    docker logs aigc-backend --tail 100 2>&1 || echo "(unable to fetch logs)"
    echo "--- End of backend logs ---"
  fi

  if _retry_curl "http://localhost/" "Frontend"; then
    log_info "Frontend: OK"
  else
    log_error "Frontend: FAILED"
    echo "--- Frontend container logs (last 100 lines) ---"
    docker logs aigc-frontend --tail 100 2>&1 || echo "(unable to fetch logs)"
    echo "--- End of frontend logs ---"
  fi
}
