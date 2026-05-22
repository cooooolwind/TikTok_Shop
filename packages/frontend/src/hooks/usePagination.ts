import { useState, useCallback } from 'react';

interface PaginationConfig {
  defaultPage?: number;
  defaultPageSize?: number;
}

/**
 * 分页状态 Hook — 封装 page/pageSize/total 管理
 * 用法：
 *   const pagination = usePagination({ defaultPageSize: 20 });
 *   <Table pagination={{ current: pagination.page, pageSize: pagination.pageSize, total: pagination.total, onChange: pagination.onChange }} />
 */
export function usePagination(config: PaginationConfig = {}) {
  const [page, setPage] = useState(config.defaultPage ?? 1);
  const [pageSize, setPageSize] = useState(config.defaultPageSize ?? 20);
  const [total, setTotal] = useState(0);

  const onChange = useCallback((p: number, ps: number) => {
    if (ps !== pageSize) {
      setPageSize(ps);
      setPage(1);
    } else {
      setPage(p);
    }
  }, [pageSize]);

  const reset = useCallback(() => {
    setPage(1);
    setPageSize(config.defaultPageSize ?? 20);
    setTotal(0);
  }, [config.defaultPageSize]);

  return {
    page,
    pageSize,
    total,
    setTotal,
    onChange,
    reset,
    // 供 API 调用使用
    query: { page, pageSize },
  };
}
