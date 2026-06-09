import { registerAs } from '@nestjs/config';

export default registerAs('volcano', () => ({
  apiKey: process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || process.env.LAS_API_KEY || '',
  baseUrl: process.env.VOLCANO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',

  // 文字模型
  textApiKey: process.env.VOLCANO_TEXT_API_KEY || process.env.VOLCANO_API_KEY || '',
  textBaseUrl: process.env.VOLCANO_TEXT_BASE_URL || process.env.VOLCANO_BASE_URL || '',
  textEndpoint: process.env.VOLCANO_TEXT_ENDPOINT || 'ep-20260514115629-vhldw',

  // 图片模型 (Seedream)
  imageApiKey: process.env.VOLCANO_IMAGE_API_KEY || process.env.VOLCANO_API_KEY || '',
  imageBaseUrl: process.env.VOLCANO_IMAGE_BASE_URL || process.env.VOLCANO_BASE_URL || '',
  imageEndpoint: process.env.VOLCANO_IMAGE_ENDPOINT || process.env.ARK_IMAGE_MODEL || '',

  // 视频模型
  videoApiKey: process.env.VOLCANO_VIDEO_API_KEY || process.env.VOLCANO_API_KEY || '',
  videoBaseUrl: process.env.VOLCANO_VIDEO_BASE_URL || process.env.VOLCANO_BASE_URL || '',
  videoEndpoint: process.env.VOLCANO_VIDEO_ENDPOINT || 'ep-20260514120705-pqv86',

  // 向量化模型 (Embedding)
  embeddingApiKey: process.env.VOLCANO_EMBEDDING_API_KEY || process.env.VOLCANO_API_KEY || '',
  embeddingBaseUrl: process.env.VOLCANO_EMBEDDING_BASE_URL || process.env.VOLCANO_BASE_URL || '',
  embeddingEndpoint: process.env.VOLCANO_EMBEDDING_ENDPOINT || '',
  embeddingDimensions: Number(process.env.VOLCANO_EMBEDDING_DIMENSIONS || '2048'),

  // 视频生成控制
  videoMaxDuration: Number(process.env.VOLCANO_VIDEO_MAX_DURATION || '12'),
  videoPollingMaxAttempts: Number(process.env.VOLCANO_VIDEO_POLLING_MAX_ATTEMPTS || '120'),
  videoPollingIntervalMs: Number(process.env.VOLCANO_VIDEO_POLLING_INTERVAL_MS || '5000'),
  videoFetchTimeoutMs: parseInt(process.env.VOLCANO_VIDEO_FETCH_TIMEOUT_MS || '60000', 10),
  chatTimeoutMs: parseInt(process.env.VOLCANO_CHAT_TIMEOUT_MS || '180000', 10),
  mockVideoUrl:
    process.env.MOCK_VIDEO_URL ||
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  mockVideoThumbnailUrl: process.env.MOCK_VIDEO_THUMBNAIL_URL || '',
  mockFirstFrameUrl:
    process.env.MOCK_FIRST_FRAME_URL || 'https://example.com/mock-first-frame.png',

  videoCreateRetryAttempts: parseInt(process.env.VOLCANO_VIDEO_CREATE_RETRY_ATTEMPTS || '3', 10),
  videoCreateRetryDelayMs: parseInt(process.env.VOLCANO_VIDEO_CREATE_RETRY_DELAY_MS || '15000', 10),
  rateLimit: {
    rpm: 100,
    tpm: 500000,
    videoConcurrency: 5,
  },
}));
