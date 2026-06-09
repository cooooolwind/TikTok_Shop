import {
  buildFirstFramePrompt,
  buildFirstFrameRetryPrompt,
  buildImageAnalysisMessages,
  buildScriptGenerationMessages,
  buildSegmentVideoPrompt,
  buildTemplatePrompt,
  buildVideoAnalysisInput,
} from './index';

const script = {
  productInfo: {
    name: 'Cooling Cardigan',
    description: 'Soft summer cardigan',
    category: 'fashion',
    selling_points: ['cool touch fabric', 'slimming fit'],
    target_audience: 'office commuters',
    price: '$29.99',
  },
  visualStyle: 'shopping livestream',
};

const segment = {
  index: 0,
  duration: 4,
  scenes: [
    {
      order: 1,
      description: 'Show cardigan fabric',
      cameraMotion: 'push in',
      dialogue: 'Buy now and save',
      subtitle: 'Limited time deal',
      visualPrompt: 'Close-up cardigan fabric',
      constraints: ['show product clearly'],
    },
  ],
};

describe('centralized AI prompt builders', () => {
  it('builds structured script blueprint messages with material grounding', () => {
    const messages = buildScriptGenerationMessages({
      productInfo: script.productInfo,
      mode: 'free',
      preferences: { duration: 12, dialogue_mode: 'enabled', dialogue_type: 'mixed' },
      template: undefined,
      materialContext: 'slice 1: Fabric close-up',
      materialMedia: [],
      manualText: undefined,
    });

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('短视频结构化剧本导演'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('带货文案师'),
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
          role: 'system',
          content: expect.stringContaining('视频切片'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('dialogue_mode = enabled'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('dialogue_mode = disabled'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('4-30 秒'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('每个分镜时长必须控制在 4-12 秒'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('"dialogue_mode":"enabled"'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('为什么要现在购买'),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('分镜画面内容'),
        }),
      ]),
    );
  });

  it('builds material analysis prompts for images and videos', () => {
    const imageMessages = buildImageAnalysisMessages('data:image/jpeg;base64,aW1hZ2U=');
    const videoInput = buildVideoAnalysisInput('file-123');

    expect(imageMessages[0]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('抖音小店内容分析专家'),
      }),
    );
    expect(videoInput[0].content[0].text).toContain('场景分割专家');
    expect(videoInput[1].content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'input_video', file_id: 'file-123' })]),
    );
  });

  it('builds video and first-frame prompts without leaking subtitle text into visual prompts', () => {
    const videoPrompt = buildSegmentVideoPrompt(script, segment, 'generated_first_frame');
    const firstFramePrompt = buildFirstFramePrompt(script, segment);
    const retryPrompt = buildFirstFrameRetryPrompt(script, segment);

    expect(videoPrompt).toContain('视觉动作：');
    expect(videoPrompt).toContain('Close-up cardigan fabric');
    expect(videoPrompt).toContain('口播台词：Buy now and save');
    expect(videoPrompt).toContain('字幕和旁白由后期处理');
    expect(videoPrompt).not.toContain('字幕：Limited time deal');
    expect(firstFramePrompt).toContain('不要在画面中生成字幕');
    expect(firstFramePrompt).not.toContain('Limited time deal');
    expect(retryPrompt).toContain('简洁的电商视频首帧');
    expect(retryPrompt).toContain('忠实地还原');
  });

  it('builds template prompts from reusable template metadata', () => {
    const prompt = buildTemplatePrompt('痛点解决型', '先痛点再方案', {
      pain: '痛点',
      cta: '转化引导',
    });

    expect(prompt).toContain('专业电商短视频编导');
    expect(prompt).toContain('当前模板名称：痛点解决型');
    expect(prompt).toContain('模板因子：痛点、转化引导');
  });
});
