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

  it('generates a Seedream first frame with reference images', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ url: 'https://example.com/first-frame.png' }],
        }),
        { status: 200 },
      ),
    );
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.imageApiKey': 'image-key',
      'volcano.imageBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.imageEndpoint': 'seedream-endpoint',
    });

    const result = await provider.generateFirstFrame({
      prompt: 'Create a product hero first frame',
      referenceImages: ['https://example.com/product.png'],
      size: '1080x1920',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer image-key' }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      model: 'seedream-endpoint',
      prompt: 'Create a product hero first frame',
      image: ['https://example.com/product.png'],
      size: '1080x1920',
      sequential_image_generation: 'disabled',
      watermark: false,
      response_format: 'url',
    });
    expect(result).toEqual({ url: 'https://example.com/first-frame.png' });
  });

  it('defaults Seedream first-frame size to the provider minimum-compatible vertical size', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ url: 'https://example.com/first-frame.png' }],
        }),
        { status: 200 },
      ),
    );
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.imageApiKey': 'image-key',
      'volcano.imageBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.imageEndpoint': 'seedream-endpoint',
    });

    await provider.generateFirstFrame({
      prompt: 'Create a product hero first frame',
      referenceImages: ['https://example.com/product.png'],
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBe('1600x2848');
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
      return_last_frame: true,
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

  it('maps queued video provider tasks to pending instead of failed', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'cgt-queued',
          status: 'queued',
        }),
        { status: 200 },
      ),
    );
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
    });

    const result = await provider.getVideoTask('cgt-queued');

    expect(result).toEqual(expect.objectContaining({ id: 'cgt-queued', status: 'pending' }));
  });

  it('serializes first-frame and reference images for image-to-video continuity', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cgt-first-frame' }), { status: 200 }));
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-video',
    });

    await provider.createVideoTask({
      prompt: 'continue this product video',
      ratio: '9:16',
      resolution: '1080p',
      duration: 4,
      firstFrameUrl: 'https://example.com/previous-last-frame.png',
      referenceImageUrls: ['https://example.com/product.png'],
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.return_last_frame).toBe(true);
    expect(body.content).toEqual([
      {
        type: 'text',
        text: 'continue this product video --duration 4 --ratio 9:16 --camerafixed false --watermark false',
      },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/previous-last-frame.png' },
        role: 'first_frame',
      },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/product.png' },
      },
    ]);
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

  it('clamps Seedance 1.5 pro video duration to 4-12 seconds', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cgt-low' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cgt-high' }), { status: 200 }));
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-video',
    });

    await provider.createVideoTask({ prompt: 'short product demo', ratio: '9:16', resolution: '1080p', duration: 2 });
    await provider.createVideoTask({ prompt: 'long product demo', ratio: '9:16', resolution: '1080p', duration: 15 });

    const lowBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const highBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(lowBody.content[0].text).toContain('--duration 4');
    expect(highBody.content[0].text).toContain('--duration 12');
  });

  it('retries video task creation without return_last_frame when Ark rejects that parameter with 404', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cgt-without-last-frame' }), { status: 200 }));
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-video',
    });

    const created = await provider.createVideoTask({
      prompt: 'product demo',
      ratio: '9:16',
      resolution: '1080p',
      duration: 5,
    });

    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(firstBody.return_last_frame).toBe(true);
    expect(secondBody).not.toHaveProperty('return_last_frame');
    expect(created).toEqual({ id: 'cgt-without-last-frame' });
  });

  it('uses a timeout signal for video task creation requests', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cgt-timeout' }), { status: 200 }));
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-video',
      'volcano.videoFetchTimeoutMs': 60000,
    });

    await provider.createVideoTask({ prompt: 'product demo', ratio: '9:16', resolution: '1080p', duration: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('surfaces video task creation network failure details', async () => {
    const networkError = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('Connect Timeout Error'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
    });
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(networkError);
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.videoApiKey': 'key',
      'volcano.videoBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.videoEndpoint': 'ep-video',
    });

    await expect(
      provider.createVideoTask({ prompt: 'product demo', ratio: '9:16', resolution: '1080p', duration: 5 }),
    ).rejects.toThrow('Volcano video task creation network failed: fetch failed; cause=Connect Timeout Error; code=UND_ERR_CONNECT_TIMEOUT');
  });

  it('returns mock file ID in mock mode without calling fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { provider } = makeProvider({ 'volcano.mockMode': true });

    const fileId = await provider.uploadFile(Buffer.from('fake-video'), 'test.mp4');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fileId).toMatch(/^mock-file-\d+$/);
  });

  it('returns active file status in mock mode without calling fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { provider } = makeProvider({ 'volcano.mockMode': true });

    const result = await provider.getFile('mock-file-123');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'mock-file-123', status: 'active' });
  });

  it('deletes file in mock mode without calling fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { provider } = makeProvider({ 'volcano.mockMode': true });

    const result = await provider.deleteFile('mock-file-123');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'mock-file-123', deleted: true });
  });

  it('returns mock multimodal analysis response in mock mode', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { provider } = makeProvider({ 'volcano.mockMode': true });

    const input = [{ role: 'user', content: [{ type: 'input_text', text: 'analyze' }] }];
    const result = await provider.createResponse(input);

    expect(fetchSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(result.content);
    expect(parsed.tags).toEqual(['mock-tag-1', 'mock-tag-2', 'mock-tag-3']);
    expect(parsed.description).toContain('Mock');
  });

  it('uploads file with purpose=user_data to Volcano Files API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'file-abc-123', object: 'file', status: 'uploaded' }), { status: 200 }),
    );
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.textApiKey': 'test-key',
      'volcano.textBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
    });

    const fileId = await provider.uploadFile(Buffer.from('fake-video-data'), 'test.mp4');

    expect(fileId).toBe('file-abc-123');
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe('https://ark.cn-beijing.volces.com/api/v3/files');
    expect(callArgs[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('extracts content from Responses API output format', async () => {
    const responsesApiBody = {
      id: 'resp-123',
      object: 'response',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: '{"tags":["tag1"],"description":"test"}' },
          ],
        },
      ],
      status: 'completed',
    };
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(responsesApiBody), { status: 200 }),
    );
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.textApiKey': 'test-key',
      'volcano.textBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.textEndpoint': 'ep-test',
    });

    const result = await provider.createResponse([{ role: 'user', content: 'hello' }]);

    expect(result.content).toBe('{"tags":["tag1"],"description":"test"}');
  });

  it('falls back to choices format when Responses API output is empty', async () => {
    const chatApiBody = {
      id: 'chat-123',
      choices: [
        { message: { role: 'assistant', content: 'chat response' }, finish_reason: 'stop' },
      ],
    };
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(chatApiBody), { status: 200 }),
    );
    const { provider } = makeProvider({
      'volcano.mockMode': false,
      'volcano.textApiKey': 'test-key',
      'volcano.textBaseUrl': 'https://ark.cn-beijing.volces.com/api/v3',
      'volcano.textEndpoint': 'ep-test',
    });

    const result = await provider.createResponse([{ role: 'user', content: 'hello' }]);

    expect(result.content).toBe('chat response');
  });
});
