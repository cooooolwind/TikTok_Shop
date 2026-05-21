// ===== 统一响应结构 =====

/** 成功响应 */
export interface ApiResponse<T> {
  code: 0;
  data: T;
  message: string;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
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

/** 错误响应 */
export interface ErrorResponse {
  code: number;
  message: string;
  details?: Record<string, string[]>;
}

/** 通用分页查询参数 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
