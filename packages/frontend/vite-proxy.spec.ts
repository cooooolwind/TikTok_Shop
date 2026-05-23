import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('vite dev proxy', () => {
  it('proxies uploaded files to the backend service', () => {
    const proxy = config.server?.proxy;

    expect(proxy).toMatchObject({
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    });
  });
});
