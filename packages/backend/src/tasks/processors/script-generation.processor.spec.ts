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
    scriptBlueprint: null,
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
      preferences?: {
        duration: number;
        dialogue_mode?: 'auto' | 'enabled' | 'disabled';
        dialogue_type?: 'mixed';
      };
      materialContext?: string;
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
  const blueprint = {
    basic_setting: '机器人清道夫与商品在复古街道中出现，强调主体设定清晰一致。',
    atmosphere_and_quality: '复古暖橙与海盐蓝色调，真实拍摄质感，画面通透明亮。',
    audio: '不需要配乐，仅保留同期声。',
    scenes: [
      {
        order: 1,
        time_range: '00:00-00:04',
        shot_size: '大全景',
        composition: '道路引导线构图',
        camera_movement: '无人机俯拍后缓慢上摇',
        visual_content: '主体从画面下方进入，沿道路高速前进，背景保持设定一致。',
        audio: '风声和脚步声。',
      },
    ],
  };

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
      expect.arrayContaining(['Hook - benefits - CTA', 'clean product demo', 4, 'script-1']),
    );
    expect(tasksGateway.emitScriptGenerated).toHaveBeenCalledWith('script-1');
    expect(result).toEqual({ script_id: 'script-1', status: 'draft' });
  });

  it('persists structured script blueprint when AI returns blueprint and scenes', async () => {
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        script_blueprint: blueprint,
        narrative_framework: '基础设定 -> 反差动作 -> 收束',
        visual_style: '复古真实质感',
        total_duration: 6,
        scenes: [
          {
            description: 'Show the subject moving through the street',
            camera_motion: 'drone tilt up',
            duration: 4,
            dialogue: '',
            bgm_style: '同期声',
            subtitle: '',
            visual_prompt: '大全景，道路引导线构图，主体高速前进。',
            constraints: ['保持主体设定一致'],
          },
        ],
      }),
    );

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('script_id'),
      expect.arrayContaining(['script-1', 1, 'Show the subject moving through the street']),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('script_blueprint'),
        expect.arrayContaining([
          '基础设定 -> 反差动作 -> 收束',
          '复古真实质感',
        4,
        blueprint,
        'script-1',
      ]),
    );
  });

  it('maps blueprint scenes into legacy scenes when AI only returns script_blueprint', async () => {
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        script_blueprint: blueprint,
        narrative_framework: '结构化蓝图',
        visual_style: '复古真实质感',
        total_duration: 14,
      }),
    );

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scenes'),
      expect.arrayContaining([
        'script-1',
        1,
        expect.stringContaining('主体从画面下方进入'),
        '无人机俯拍后缓慢上摇',
        4,
        '',
        '不需要配乐，仅保留同期声。',
        '',
        expect.stringContaining('基础设定：机器人清道夫'),
      ]),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('script_blueprint'),
      expect.arrayContaining(['结构化蓝图', '复古真实质感', 4, blueprint, 'script-1']),
    );
  });

  it('persists a 30 second script total without clipping the whole script to 12 seconds', async () => {
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Hook - demo - CTA',
        visual_style: 'cinematic commerce',
        total_duration: 30,
        scenes: [
          { description: 'Scene 1', camera_motion: 'push in', duration: 10 },
          { description: 'Scene 2', camera_motion: 'pan', duration: 10 },
          { description: 'Scene 3', camera_motion: 'tilt', duration: 10 },
        ],
      }),
    );
    job.data.preferences = { duration: 30 };

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scenes'),
      expect.arrayContaining(['Scene 1', 'push in', 10, 'Scene 2', 'pan', 10, 'Scene 3', 'tilt', 10]),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE scripts'),
      expect.arrayContaining(['Hook - demo - CTA', 'cinematic commerce', 30, 'script-1']),
    );
  });

  it('clamps each scene to 12 seconds while allowing the script total up to 30 seconds', async () => {
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Long single segment',
        visual_style: 'clean',
        total_duration: 18,
        scenes: [{ description: 'Long scene', camera_motion: 'fixed', duration: 18 }],
      }),
    );
    job.data.preferences = { duration: 30 };

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scenes'),
      expect.arrayContaining(['Long scene', 'fixed', 12]),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE scripts'),
      expect.arrayContaining(['Long single segment', 'clean', 12, 'script-1']),
    );
  });

  it('clips normalized scene totals to the requested script duration when it is below 30 seconds', async () => {
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Twenty second target',
        visual_style: 'clean',
        total_duration: 30,
        scenes: [
          { description: 'Scene 1', camera_motion: 'push in', duration: 10 },
          { description: 'Scene 2', camera_motion: 'pan', duration: 10 },
          { description: 'Scene 3', camera_motion: 'tilt', duration: 10 },
        ],
      }),
    );
    job.data.preferences = { duration: 20 };

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scenes'),
      expect.not.arrayContaining(['Scene 3']),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE scripts'),
      expect.arrayContaining(['Twenty second target', 'clean', 20, 'script-1']),
    );
  });

  it('applies 4-12 second scene rules when mapping blueprint-only responses', async () => {
    const longBlueprint = {
      ...blueprint,
      scenes: [
        { ...blueprint.scenes[0], time_range: '00:00-00:15', visual_content: 'Long blueprint scene' },
        { ...blueprint.scenes[0], order: 2, time_range: '00:15-00:18', visual_content: 'Short blueprint scene' },
      ],
    };
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        script_blueprint: longBlueprint,
        narrative_framework: 'Blueprint only',
        visual_style: 'cinematic',
        total_duration: 18,
      }),
    );
    job.data.preferences = { duration: 30 };

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scenes'),
      expect.arrayContaining(['Long blueprint scene', '无人机俯拍后缓慢上摇', 12, 'Short blueprint scene', '无人机俯拍后缓慢上摇', 4]),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE scripts'),
      expect.arrayContaining(['Blueprint only', 'cinematic', 16, longBlueprint, 'script-1']),
    );
  });

  it('keeps dialogue and subtitle when mapping blueprint scenes into legacy scenes', async () => {
    const dialogueBlueprint = {
      ...blueprint,
      audio: '轻快同期声，角色自然说话。',
      scenes: [
        {
          ...blueprint.scenes[0],
          dialogue: '这台小相机放进口袋就能出门拍摄。',
          subtitle: '口袋相机，随手开拍',
          audio: '角色口播与轻微街道环境声。',
        },
      ],
    };
    const { processor, scenesRepository, job } = makeProcessor(
      JSON.stringify({
        script_blueprint: dialogueBlueprint,
        narrative_framework: '结构化蓝图',
        visual_style: '真实带货短片',
        total_duration: 4,
      }),
    );

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scenes'),
      expect.arrayContaining([
        '这台小相机放进口袋就能出门拍摄。',
        '轻快同期声，角色自然说话。',
        '口袋相机，随手开拍',
      ]),
    );
  });

  it('allows silent dialogue and subtitle fields for sync-sound-only blueprints', async () => {
    const { processor, scenesRepository, job } = makeProcessor(
      JSON.stringify({
        script_blueprint: blueprint,
        scenes: [
          {
            description: 'Ambient product scene',
            camera_motion: 'fixed',
            duration: 4,
            dialogue: '',
            bgm_style: '同期声',
            subtitle: '',
            visual_prompt: 'Ambient scene with no spoken line.',
            constraints: [],
          },
        ],
      }),
    );

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['', '同期声', '', 'Ambient scene with no spoken line.']),
    );
  });

  it('strips dialogue and subtitle before persistence when dialogue generation is disabled', async () => {
    const dialogueBlueprint = {
      ...blueprint,
      audio: '旁白：介绍商品卖点，背景保留街道环境声。',
      scenes: [
        {
          ...blueprint.scenes[0],
          audio: '角色说：这款商品很好用。',
          dialogue: 'AI should not keep this line.',
          subtitle: 'AI should not keep this subtitle.',
        },
      ],
    };
    const { processor, scenesRepository, scriptsRepository, job } = makeProcessor(
      JSON.stringify({
        script_blueprint: dialogueBlueprint,
        scenes: [
          {
            description: 'Product shot',
            camera_motion: 'push in',
            duration: 4,
            dialogue: 'AI should not keep this line.',
            bgm_style: '旁白口播，配合环境声',
            subtitle: 'AI should not keep this subtitle.',
            visual_prompt: 'Product shot',
          },
        ],
      }),
    );
    job.data.preferences = { duration: 12, dialogue_mode: 'disabled', dialogue_type: 'mixed' };

    await processor.process(job as never);

    expect(scenesRepository.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['Product shot', 'push in', 4, '', '仅保留同期声和环境声', '', 'Product shot']),
    );
    expect(scriptsRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('script_blueprint'),
      expect.arrayContaining([
        expect.objectContaining({
          audio: '仅保留同期声和环境声，不包含口播、旁白或对白',
          scenes: [
            expect.objectContaining({
              audio: '仅保留同期声和环境声',
              dialogue: '',
              subtitle: '',
            }),
          ],
        }),
      ]),
    );
  });

  it('当 AI 返回无效 JSON 时标记剧本失败', async () => {
    const { processor, scriptsRepository, tasksGateway, job } = makeProcessor('not json');

    await expect(processor.process(job as never)).rejects.toThrow('AI 返回结果不是合法 JSON');

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

  it('uses structured blueprint prompt and generation objective payload', async () => {
    const { processor, volcanoClient, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Hook - proof - CTA',
        visual_style: 'shopping livestream',
        total_duration: 6,
        scenes: [{ description: 'Scene', duration: 3 }],
      }),
    );
    job.data.productInfo = {
      name: 'Cooling Cardigan',
      description: 'Soft summer cardigan',
      category: 'fashion',
      selling_points: ['cool touch fabric', 'slimming fit'],
      target_audience: 'office commuters',
      price: '$29.99',
    };
    job.data.preferences = { duration: 12, dialogue_mode: 'disabled', dialogue_type: 'mixed' };

    await processor.process(job as never);

    expect(volcanoClient.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('短视频结构化剧本导演'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('script_blueprint'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('基础设定'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('"dialogue_mode":"disabled"'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('分镜画面内容'),
        }),
      ]),
      expect.objectContaining({ response_format: { type: 'json_object' } }),
    );
  });
  it('instructs AI to ground scenes in material AI analysis and video slices', async () => {
    const { processor, volcanoClient, job } = makeProcessor(
      JSON.stringify({
        narrative_framework: 'Hook',
        visual_style: 'clean',
        total_duration: 3,
        scenes: [{ description: 'Scene', duration: 3 }],
      }),
    );
    job.data.materialContext =
      'Material material-1; ai_tags=breathable; ai_description=Model try-on\nslice 1: 0-2s; description=Fabric close-up; tags=fabric';

    await processor.process(job as never);

    expect(volcanoClient.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('优先参考素材 AI 分析'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('视频切片'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Fabric close-up'),
        }),
      ]),
      expect.anything(),
    );
  });
});
