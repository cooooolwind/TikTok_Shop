import { ConfigService } from '@nestjs/config';
import { VolcanoClientProvider } from './volcano-client.provider';

function makeProvider(config: Record<string, unknown>) {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  };
  return { provider: new VolcanoClientProvider(configService as unknown as ConfigService), configService };
}

describe('VolcanoClientProvider video generation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns mock video task data without calling fetch when mock mode is enabled', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { provider } = makeProvider({
      'volcano.mockMode': true,
      'volcano.mockVideoUrl': 'https://example.com/mock.mp4',
      'volcano.mockVideoThumbnailUrl': 'https://example.com/mock.png',
    });

    const created = await provider.createVideoTask({ prompt: 'product demo', ratio: '9:16', resolution: '1080p', duration: 8 });
    const result = await provider.getVideoTask(created.id);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(created).toEqual({ id: 'mock_video_task' });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'succeeded',
        content: { video_url: 'https://example.com/mock.mp4', last_frame_url: 'https://example.com/mock.png' },
      }),
    );
  });

  it('throws a clear configuration error when video credentials are missing', async () => {
    const { provider } = makeProvider({ 'volcano.mockMode': false });

    await expect(
      provider.createVideoTask({ prompt: 'product demo', ratio: '9:16', resolution: '1080p', duration: 8 }),
    ).rejects.toThrow('VOLCANO_VIDEO_API_KEY and VOLCANO_VIDEO_ENDPOINT are required');
  });

  it('creates and queries real video tasks with the Ark content generation path', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/contents/generations/tasks')) {
        return new Response(JSON.stringify({ id: 'cgt-1' }), { status: 200 });
      }
      if (url.endsWith('/contents/generations/tasks/cgt-1')) {
        return new Response(
          JSON.stringify({
            id: 'cgt-1',
            status: 'succeeded',
            content: { video_url: 'https://example.com/video.mp4', last_frame_url: 'https://example.com/thumb.png' },
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });
    const { provider, configService } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-20260514120705-pqv86',
    });

    const created = await provider.createVideoTask({
      prompt: 'product demo',
      ratio: '9:16',
      resolution: '1080p',
      duration: 8,
      imageUrls: ['https://example.com/product.png'],
    });
    const result = await provider.getVideoTask('cgt-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer key' }),
        body: expect.stringContaining('"model":"ep-20260514120705-pqv86"'),
      }),
    );
    expect(configService.get).not.toHaveBeenCalledWith('volcano.videoModel');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      model: 'ep-20260514120705-pqv86',
      content: [
        {
          type: 'text',
          text: 'product demo --duration 8 --ratio 9:16 --camerafixed false --watermark false',
        },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/product.png' },
        },
      ],
    });
    expect(created).toEqual({ id: 'cgt-1' });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'cgt-1',
        status: 'succeeded',
        content: { video_url: 'https://example.com/video.mp4', last_frame_url: 'https://example.com/thumb.png' },
      }),
    );
  });

  it('retries video task creation when Ark returns an RPM rate limit error', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'EndpointAccountRpmRateLimitExceeded',
              message: 'RPM limit exceeded',
              type: 'TooManyRequests',
            },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cgt-after-retry' }), { status: 200 }));
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-video',
      'volcano.videoCreateRetryAttempts': 2,
      'volcano.videoCreateRetryDelayMs': 0,
    });

    const created = await provider.createVideoTask({ prompt: 'product demo', ratio: '9:16', resolution: '1080p', duration: 5 });

    expect(created).toEqual({ id: 'cgt-after-retry' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
