import { registerAs } from '@nestjs/config';

export default registerAs('volcano', () => ({
  apiKey: process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || process.env.LAS_API_KEY || '',
  baseUrl: process.env.VOLCANO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  textApiKey: process.env.VOLCANO_TEXT_API_KEY || process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || '',
  textBaseUrl: process.env.VOLCANO_TEXT_BASE_URL || process.env.VOLCANO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  textEndpoint: process.env.VOLCANO_TEXT_ENDPOINT || '',
  videoApiKey:
    process.env.VOLCANO_VIDEO_API_KEY ||
    process.env.VOLCANO_API_KEY ||
    process.env.ARK_API_KEY ||
    process.env.LAS_API_KEY ||
    '',
  videoBaseUrl: process.env.VOLCANO_VIDEO_BASE_URL || process.env.VOLCANO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  videoEndpoint: process.env.VOLCANO_VIDEO_ENDPOINT || '',
  videoMaxDuration: Number(process.env.VOLCANO_VIDEO_MAX_DURATION || '12'),
  videoPollingMaxAttempts: Number(process.env.VOLCANO_VIDEO_POLLING_MAX_ATTEMPTS || '120'),
  videoPollingIntervalMs: Number(process.env.VOLCANO_VIDEO_POLLING_INTERVAL_MS || '5000'),
  mockVideoUrl:
    process.env.MOCK_VIDEO_URL ||
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  mockVideoThumbnailUrl: process.env.MOCK_VIDEO_THUMBNAIL_URL || '',
  mockMode: process.env.MOCK_MODE === 'true',
  rateLimit: {
    rpm: 100,
    tpm: 500000,
    videoConcurrency: 5,
  },
}));
