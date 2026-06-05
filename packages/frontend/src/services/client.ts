import axios from 'axios';
import type { ApiResponse } from '@aigc/shared-types';

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 180000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器 — 注入 Token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 — 剥离 AxiosResponse 外层，后续 .get<T, R> 直接拿到 R
client.interceptors.response.use(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (response: any) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '网络错误';
    console.error('[API Error]', message);
    return Promise.reject(error);
  },
);

export default client;
