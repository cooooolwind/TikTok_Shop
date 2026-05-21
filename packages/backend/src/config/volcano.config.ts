import { registerAs } from '@nestjs/config';

export default registerAs('volcano', () => ({
  apiKey: process.env.VOLCANO_API_KEY || '',
  baseUrl: process.env.VOLCANO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  textEndpoint: process.env.VOLCANO_TEXT_ENDPOINT || '',
  videoEndpoint: process.env.VOLCANO_VIDEO_ENDPOINT || '',
  mockMode: process.env.MOCK_MODE === 'true',
  rateLimit: {
    rpm: 100,
    tpm: 500000,
    videoConcurrency: 5,
  },
}));
