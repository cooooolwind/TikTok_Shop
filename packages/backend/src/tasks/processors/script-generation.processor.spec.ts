import { ScriptGenerationProcessor } from './script-generation.processor';
import { Script } from '../../modules/scripts/entities/script.entity';

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    merchantId: 'default',
    productInfo: { name: 'Dress', description: 'Desc', category: 'fashion', selling_points: [] },
    templateId: null as never,
    referenceId: null as never,
    sourceMaterialIds: [],
    generationTaskId: 'script_generation_script-1',
    generationError: null as never,
    mode: 'free',
    narrativeFramework: '',
    visualStyle: '',
    totalDuration: 15,
    status: 'generating',
    scenes: [],
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    updatedAt: new Date('2026-05-23T00:00:00.000Z'),
    ...overrides,
  };
}

function makeProcessor(aiContent: string | Error) {
  const script = makeScript();
  const scriptsRepository = {
    findOne: jest.fn(async () => script),
    query: jest.fn(async () => []),
    save: jest.fn(async (data) => data),
  };
  const scenesRepository = {
    delete: jest.fn(async () => ({ affected: 0 })),
    query: jest.fn(async () => []),
    insert: jest.fn(async () => ({ identifiers: [] })),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
  const volcanoClient = {
    chatCompletion: jest.fn(async () => {
      if (aiContent instanceof Error) throw aiContent;
      return { content: aiContent };
    }),
  };
  const tasksGateway = {
    emitTaskProgress: jest.fn(),
    emitTaskFailed: jest.fn(),
    emitScriptGenerated: jest.fn(),
  };
  const processor = new ScriptGenerationProcessor(
    scriptsRepository as never,
    scenesRepository as never,
    volcanoClient as never,
    tasksGateway as never,
  );
  const job: {
    data: {
      taskId: string;
      scriptId: string;
      productInfo: Script['productInfo'];
      mode: string;
      materialMedia?: { type: 'image' | 'video'; filename: string; imageUrl?: string }[];
    };
    updateProgress: jest.Mock;
  } = {
    data: {
      taskId: 'script_generation_script-1',
      scriptId: 'script-1',
      productInfo: script.productInfo,
      mode: 'free',
    },
    updateProgress: jest.fn(),
  };

  return { processor, scriptsRepository, scenesRepository, volcanoClient, tasksGateway, job, script };
}

describe('ScriptGenerationProcessor', () => {
  it('persists scenes and marks script draft when AI returns valid JSON', async () => {
    const { processor, scenesRepository, scriptsRepository, tasksGateway, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Hook - benefits - CTA',
        visual_style: 'clean product demo',
        total_duration: 6,
        scenes: [
          {
            description: 'Show dress details',
            camera_motion: 'push in',
            duration: 3,
            dialogue: 'Light and breathable',
            bgm_style: 'upbeat',
            subtitle: 'Breathable summer dress',
            visual_prompt: 'Close-up dress fabric',
            constraints: ['show product'],
          },
        ],
      }),
    );

    const result = await processor.process(job as never);

    expect(scenesRepository.delete).toHaveBeenCalledWith({ scriptId: 'script-1' });
    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('script_id'),
      expect.arrayContaining(['script-1', 1, 'Show dress details']),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE scripts'),
      expect.arrayContaining(['Hook - benefits - CTA', 'clean product demo', 6, 'script-1']),
    );
    expect(tasksGateway.emitScriptGenerated).toHaveBeenCalledWith('script-1');
    expect(result).toEqual({ script_id: 'script-1', status: 'draft' });
  });

  it('marks script failed when AI returns invalid JSON', async () => {
    const { processor, scriptsRepository, tasksGateway, job } = makeProcessor('not json');

    await expect(processor.process(job as never)).rejects.toThrow('AI response is not valid JSON');

    expect(scriptsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(tasksGateway.emitTaskFailed).toHaveBeenCalledWith(
      'script_generation_script-1',
      expect.objectContaining({ code: 'SCRIPT_GENERATION_FAILED' }),
    );
  });

  it('sends image materials to AI as OpenAI-compatible image_url content', async () => {
    const { processor, volcanoClient, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Hook',
        visual_style: 'clean',
        total_duration: 3,
        scenes: [{ description: 'Scene', duration: 3 }],
      }),
    );
    job.data.materialMedia = [
      {
        type: 'image',
        filename: 'dress.jpg',
        imageUrl: 'data:image/jpeg;base64,aW1hZ2U=',
      },
    ];

    await processor.process(job as never);

    expect(volcanoClient.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'text' }),
            expect.objectContaining({
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,aW1hZ2U=' },
            }),
          ]),
        }),
      ]),
      expect.anything(),
    );
  });
});
