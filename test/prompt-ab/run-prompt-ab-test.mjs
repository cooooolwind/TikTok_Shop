#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const outputRoot = path.join(__dirname, 'output');
const defaultMediaRoot = path.join(repoRoot, 'test', 'vedio');

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'expired', 'cancelled']);
const VIDEO_VARIANTS = ['baseline', 'with_global_brief'];

const DEFAULT_PRODUCT = {
  name: 'Portable Mini Blender',
  description:
    'A compact rechargeable blender for smoothies, protein shakes, and fresh juice on the go.',
  category: 'kitchen appliance',
  selling_points: [
    'portable and rechargeable',
    'easy to clean',
    'strong blending power',
    'suitable for office, gym, and travel',
  ],
  target_audience: 'busy young professionals and fitness users',
  price: '$29.99',
  images: [],
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const env = await loadEnv(path.join(repoRoot, '.env'));
  const config = buildConfig(env, args);
  const product = await loadProduct(args.productJson);
  const timestamp = makeTimestamp();
  const outputDir = path.join(outputRoot, timestamp);
  await mkdir(outputDir, { recursive: true });

  console.log(`[prompt-ab] Output: ${outputDir}`);
  console.log(`[prompt-ab] Mode: ${config.mode}`);
  console.log('[prompt-ab] Generating global brief and scenes with text AI...');

  const aiScript = normalizeAiScript(await generateAiScript(config, product));
  const scenesForPrompt = aiScript.scenes;
  const scenesForVideo = scenesForPrompt.slice(0, config.maxScenes);

  const baselinePrompts = scenesForPrompt.map((scene, index) =>
    buildVideoPrompt({
      product,
      aiScript,
      scene,
      sceneIndex: index,
      includeGlobalBrief: false,
      ratio: config.ratio,
      resolution: config.resolution,
    }),
  );
  const globalBriefPrompts = scenesForPrompt.map((scene, index) =>
    buildVideoPrompt({
      product,
      aiScript,
      scene,
      sceneIndex: index,
      includeGlobalBrief: true,
      ratio: config.ratio,
      resolution: config.resolution,
    }),
  );

  await writeJson(path.join(outputDir, 'ai-script.json'), aiScript);
  await writeJson(path.join(outputDir, 'prompts-baseline.json'), baselinePrompts);
  await writeJson(path.join(outputDir, 'prompts-with-global-brief.json'), globalBriefPrompts);

  let videoResults = {
    mode: config.mode,
    generated: false,
    max_scenes: config.maxScenes,
    variants: VIDEO_VARIANTS,
    results: [],
  };

  if (config.mode === 'video' || config.mode === 'both') {
    assertVideoConfig(config);
    console.log(`[prompt-ab] Creating video A/B tasks for ${scenesForVideo.length} scene(s)...`);
    videoResults = await generateVideoComparisons({
      config,
      product,
      scenes: scenesForVideo,
      baselinePrompts,
      globalBriefPrompts,
    });
  }

  await writeJson(path.join(outputDir, 'video-results.json'), videoResults);
  await writeFile(
    path.join(outputDir, 'report.md'),
    buildReport({
      config,
      product,
      aiScript,
      baselinePrompts,
      globalBriefPrompts,
      videoResults,
    }),
    'utf8',
  );

  console.log('[prompt-ab] Done.');
  console.log(`[prompt-ab] Report: ${path.join(outputDir, 'report.md')}`);
}

function parseArgs(argv) {
  const args = {
    mode: 'prompt',
    maxScenes: 2,
    ratio: '9:16',
    resolution: '1080p',
    pollIntervalMs: 5000,
    pollAttempts: 120,
    productJson: '',
    mediaDir: defaultMediaRoot,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if (current === '--help' || current === '-h') {
      args.help = true;
    } else if (current === '--mode') {
      args.mode = requireValue(current, next);
      i += 1;
    } else if (current === '--max-scenes') {
      args.maxScenes = toPositiveInt(requireValue(current, next), current);
      i += 1;
    } else if (current === '--product-json') {
      args.productJson = requireValue(current, next);
      i += 1;
    } else if (current === '--ratio') {
      args.ratio = requireValue(current, next);
      i += 1;
    } else if (current === '--resolution') {
      args.resolution = requireValue(current, next);
      i += 1;
    } else if (current === '--poll-interval-ms') {
      args.pollIntervalMs = toPositiveInt(requireValue(current, next), current);
      i += 1;
    } else if (current === '--poll-attempts') {
      args.pollAttempts = toPositiveInt(requireValue(current, next), current);
      i += 1;
    } else if (current === '--media-dir') {
      args.mediaDir = path.resolve(process.cwd(), requireValue(current, next));
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${current}`);
    }
  }

  if (!['prompt', 'video', 'both'].includes(args.mode)) {
    throw new Error('--mode must be one of: prompt, video, both');
  }
  return args;
}

function requireValue(name, value) {
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function toPositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function loadEnv(envPath) {
  const env = { ...process.env };
  if (!existsSync(envPath)) return env;

  const content = await readFile(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in env)) env[key] = value;
  }
  return env;
}

function buildConfig(env, args) {
  const config = {
    mode: args.mode,
    maxScenes: args.maxScenes,
    ratio: args.ratio,
    resolution: args.resolution,
    pollIntervalMs: args.pollIntervalMs,
    pollAttempts: args.pollAttempts,
    mediaDir: args.mediaDir,
    textApiKey: env.VOLCANO_TEXT_API_KEY || env.VOLCANO_API_KEY || env.ARK_API_KEY || '',
    textBaseUrl:
      env.VOLCANO_TEXT_BASE_URL ||
      env.VOLCANO_BASE_URL ||
      'https://ark.cn-beijing.volces.com/api/v3',
    textModel: env.VOLCANO_TEXT_ENDPOINT || '',
    videoApiKey:
      env.VOLCANO_VIDEO_API_KEY || env.VOLCANO_API_KEY || env.ARK_API_KEY || env.LAS_API_KEY || '',
    videoBaseUrl:
      env.VOLCANO_VIDEO_BASE_URL ||
      env.VOLCANO_BASE_URL ||
      'https://ark.cn-beijing.volces.com/api/v3',
    videoModel: env.VOLCANO_VIDEO_ENDPOINT || '',
  };

  if (!config.textApiKey || !config.textModel) {
    throw new Error('VOLCANO_TEXT_API_KEY/VOLCANO_API_KEY and VOLCANO_TEXT_ENDPOINT are required');
  }
  return config;
}

function assertVideoConfig(config) {
  if (!config.videoApiKey || !config.videoModel) {
    throw new Error('VOLCANO_VIDEO_API_KEY/VOLCANO_API_KEY and VOLCANO_VIDEO_ENDPOINT are required');
  }
}

async function loadProduct(productJsonPath) {
  if (!productJsonPath) return DEFAULT_PRODUCT;
  const resolved = path.resolve(process.cwd(), productJsonPath);
  const parsed = JSON.parse(await readFile(resolved, 'utf8'));
  return {
    ...DEFAULT_PRODUCT,
    ...parsed,
    selling_points: Array.isArray(parsed.selling_points)
      ? parsed.selling_points
      : DEFAULT_PRODUCT.selling_points,
    images: Array.isArray(parsed.images) ? parsed.images : [],
  };
}

async function generateAiScript(config, product) {
  const messages = [
    {
      role: 'system',
      content:
        'You are a TikTok Shop creative director. Return only valid JSON. Do not include markdown fences.',
    },
    {
      role: 'user',
      content: buildScriptGenerationPrompt(product),
    },
  ];

  const data = await postJson({
    url: `${trimTrailingSlash(config.textBaseUrl)}/chat/completions`,
    apiKey: config.textApiKey,
    body: {
      model: config.textModel,
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    },
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Text AI returned empty content');
  return parseJsonContent(content);
}

function buildScriptGenerationPrompt(product) {
  return [
    'Generate a complete short TikTok Shop video plan for this product.',
    'The global_video_brief and scenes must be coherent with each other.',
    'Total script duration should be no longer than 12 seconds.',
    'Return strict JSON with this shape:',
    JSON.stringify(
      {
        global_video_brief:
          'A concise visual and narrative brief shared by all scene video prompts.',
        visual_style: 'Overall commercial visual style.',
        narrative_framework: 'Hook - benefit - proof - CTA style narrative.',
        scenes: [
          {
            order: 1,
            description: 'What this scene does in the story.',
            visual_prompt: 'Detailed visual action for video generation.',
            camera_motion: 'push in / pan / fixed / orbit / handheld',
            duration: 4,
            dialogue: 'Voiceover line.',
            subtitle: 'Short subtitle.',
            constraints: ['Keep product visible'],
          },
        ],
      },
      null,
      2,
    ),
    'Requirements:',
    '- Create 3 to 4 scenes.',
    '- Each scene duration must be an integer from 4 to 12 seconds.',
    '- Use English prompts for video generation.',
    '- Keep each visual_prompt concrete, camera-ready, and focused on one scene.',
    '- Do not mention unavailable celebrity names, protected brands, or unsafe claims.',
    '',
    `Product JSON: ${JSON.stringify(product)}`,
  ].join('\n');
}

function parseJsonContent(content) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const first = withoutFence.indexOf('{');
    const last = withoutFence.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(withoutFence.slice(first, last + 1));
    throw new Error('Text AI response is not valid JSON');
  }
}

function normalizeAiScript(input) {
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  if (!input.global_video_brief || scenes.length === 0) {
    throw new Error('AI script must include global_video_brief and non-empty scenes');
  }

  return {
    global_video_brief: String(input.global_video_brief),
    visual_style: String(input.visual_style || 'clean TikTok Shop product demo'),
    narrative_framework: String(input.narrative_framework || 'Hook - benefits - CTA'),
    scenes: scenes.map((scene, index) => ({
      order: Number(scene.order) || index + 1,
      description: String(scene.description || scene.visual_prompt || 'Product scene'),
      visual_prompt: String(scene.visual_prompt || scene.description || 'Product scene'),
      camera_motion: String(scene.camera_motion || 'fixed'),
      duration: clamp(Math.round(Number(scene.duration) || 4), 4, 12),
      dialogue: String(scene.dialogue || ''),
      subtitle: String(scene.subtitle || scene.dialogue || ''),
      constraints: Array.isArray(scene.constraints) ? scene.constraints.map(String) : [],
    })),
  };
}

function buildVideoPrompt({
  product,
  aiScript,
  scene,
  sceneIndex,
  includeGlobalBrief,
  ratio,
  resolution,
}) {
  const outputDuration = toProviderDuration(scene.duration);
  const continuityInput =
    sceneIndex === 0 && product.images?.[0]
      ? 'Use the provided first-frame product image as the visual anchor.'
      : sceneIndex === 0
        ? 'No first-frame image is available. Use the product description as the visual anchor.'
        : 'Use the previous segment last frame as the first frame. Continue from it and preserve product identity.';

  return {
    variant: includeGlobalBrief ? 'with_global_brief' : 'baseline',
    scene_order: scene.order,
    provider_duration: outputDuration,
    scene_intent_duration: scene.duration,
    ratio,
    resolution,
    prompt: [
      'Create one TikTok Shop video segment.',
      '',
      includeGlobalBrief ? `Global video brief:\n${aiScript.global_video_brief}` : '',
      '',
      'Product:',
      `Name: ${product.name || 'the product'}`,
      `Category: ${product.category || 'e-commerce product'}`,
      `Description: ${product.description || ''}`,
      `Selling points: ${(product.selling_points || []).join(', ') || 'core product benefits'}`,
      product.target_audience ? `Target audience: ${product.target_audience}` : '',
      product.price ? `Price context: ${product.price}` : '',
      '',
      'Global style:',
      aiScript.visual_style,
      '',
      'Narrative role:',
      aiScript.narrative_framework,
      '',
      'Segment timing:',
      `Output duration: ${outputDuration} seconds.`,
      `Scene intent duration: about ${scene.duration} seconds.`,
      scene.duration < outputDuration
        ? 'If the scene intent is shorter than the output duration, use the remaining time for natural product hold, motion easing, or a clean ending frame. Do not add new story beats.'
        : 'Use the full output duration to complete this scene clearly without rushing.',
      '',
      'Continuity input:',
      continuityInput,
      'Keep product identity, color, shape, material, lighting direction, background style, and commercial tone consistent across segments.',
      '',
      'Current scene:',
      `Order: ${scene.order}`,
      `Description: ${scene.description}`,
      `Visual action: ${scene.visual_prompt}`,
      `Camera: ${scene.camera_motion}`,
      `Voiceover: ${scene.dialogue}`,
      `Subtitle: ${scene.subtitle}`,
      `Constraints: ${scene.constraints.join(', ') || 'Keep the product visible and recognizable.'}`,
      '',
      'Final instruction:',
      'Generate only this scene. Keep the product visible, commercially safe, and suitable for e-commerce conversion.',
    ]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

async function generateVideoComparisons({ config, product, scenes, baselinePrompts, globalBriefPrompts }) {
  const mediaDir = path.join(config.mediaDir, makeTimestamp());
  await mkdir(mediaDir, { recursive: true });
  const previousLastFrameByVariant = {
    baseline: product.images?.[0] || '',
    with_global_brief: product.images?.[0] || '',
  };
  const results = [];

  for (const [sceneIndex, scene] of scenes.entries()) {
    for (const variant of VIDEO_VARIANTS) {
      const promptItem =
        variant === 'baseline' ? baselinePrompts[sceneIndex] : globalBriefPrompts[sceneIndex];
      const firstFrameUrl = previousLastFrameByVariant[variant] || '';
      const content = [{ type: 'text', text: promptItem.prompt }];
      if (firstFrameUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: firstFrameUrl },
          role: 'first_frame',
        });
      }

      const createBody = {
        model: config.videoModel,
        content,
        return_last_frame: true,
        resolution: config.resolution,
        ratio: config.ratio,
        duration: promptItem.provider_duration,
        camera_fixed: false,
        watermark: false,
      };

      console.log(
        `[prompt-ab] Create ${variant} scene ${scene.order}, duration=${promptItem.provider_duration}s`,
      );

      const created = await createVideoTask(config, createBody);
      const taskResult = await pollVideoTask(config, created.id);
      const normalized = {
        variant,
        scene_order: scene.order,
        task_id: created.id,
        status: taskResult.status,
        input_first_frame_url: firstFrameUrl,
        video_url: taskResult.content?.video_url || taskResult.content?.file_url || '',
        last_frame_url: taskResult.content?.last_frame_url || '',
        duration: taskResult.duration ?? null,
        ratio: taskResult.ratio ?? config.ratio,
        resolution: taskResult.resolution ?? config.resolution,
        error: taskResult.error || null,
        local_video_path: '',
        local_last_frame_path: '',
      };

      if (normalized.status === 'succeeded' && normalized.video_url) {
        normalized.local_video_path = await downloadFile(
          normalized.video_url,
          path.join(mediaDir, `scene-${scene.order}-${variant}.mp4`),
        );
      }
      if (normalized.status === 'succeeded' && normalized.last_frame_url) {
        normalized.local_last_frame_path = await downloadFile(
          normalized.last_frame_url,
          path.join(mediaDir, `scene-${scene.order}-${variant}-last-frame.png`),
        );
      }
      results.push(normalized);

      if (normalized.status === 'succeeded' && normalized.last_frame_url) {
        previousLastFrameByVariant[variant] = normalized.last_frame_url;
      } else {
        previousLastFrameByVariant[variant] = '';
      }
    }
  }

  return {
    mode: config.mode,
    generated: true,
    media_dir: mediaDir,
    max_scenes: config.maxScenes,
    variants: VIDEO_VARIANTS,
    results,
  };
}

async function createVideoTask(config, body) {
  const data = await postJson({
    url: `${trimTrailingSlash(config.videoBaseUrl)}/contents/generations/tasks`,
    apiKey: config.videoApiKey,
    body,
  });
  if (!data?.id) throw new Error('Video task creation returned empty id');
  return data;
}

async function pollVideoTask(config, taskId) {
  for (let attempt = 0; attempt < config.pollAttempts; attempt += 1) {
    const result = await getJson({
      url: `${trimTrailingSlash(config.videoBaseUrl)}/contents/generations/tasks/${taskId}`,
      apiKey: config.videoApiKey,
    });
    if (TERMINAL_STATUSES.has(result.status)) return result;
    if (attempt < config.pollAttempts - 1) await sleep(config.pollIntervalMs);
  }
  return {
    id: taskId,
    status: 'expired',
    error: {
      code: 'LOCAL_POLL_TIMEOUT',
      message: `Polling timed out after ${config.pollAttempts} attempts`,
    },
  };
}

async function postJson({ url, apiKey, body }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response, url);
}

async function getJson({ url, apiKey }) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  return parseResponse(response, url);
}

async function parseResponse(response, url) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, bytes);
  return targetPath;
}

function buildReport({ config, product, aiScript, baselinePrompts, globalBriefPrompts, videoResults }) {
  const lines = [
    '# Global Brief 分镜视频 A/B 测试报告',
    '',
    '## 基本信息',
    '',
    `- 运行模式：${config.mode}`,
    `- 文本模型 Endpoint：${config.textModel}`,
    `- 视频模型 Endpoint：${config.videoModel || '未启用视频模式'}`,
    `- 商品：${product.name}`,
    `- 分镜数量：${aiScript.scenes.length}`,
    `- 视频测试分镜上限：${config.maxScenes}`,
    `- 输出比例：${config.ratio}`,
    `- 输出分辨率：${config.resolution}`,
    `- 视频保存目录：${config.mediaDir}`,
    '',
    '## AI 生成的 Global Brief',
    '',
    aiScript.global_video_brief,
    '',
    '## Prompt 对比',
    '',
  ];

  for (let i = 0; i < baselinePrompts.length; i += 1) {
    lines.push(`### Scene ${baselinePrompts[i].scene_order}`);
    lines.push('');
    lines.push('#### Baseline');
    lines.push('');
    lines.push('```txt');
    lines.push(baselinePrompts[i].prompt);
    lines.push('```');
    lines.push('');
    lines.push('#### With Global Brief');
    lines.push('');
    lines.push('```txt');
    lines.push(globalBriefPrompts[i].prompt);
    lines.push('```');
    lines.push('');
  }

  lines.push('## 视频结果');
  lines.push('');
  if (!videoResults.generated) {
    lines.push('本次未启用视频生成。使用 `--mode video` 或 `--mode both` 生成真实 A/B 视频。');
  } else {
    for (const result of videoResults.results) {
      lines.push(
        `- Scene ${result.scene_order} / ${result.variant}: ${result.status}, task=${result.task_id}, duration=${result.duration ?? '-'}, video=${result.video_url || '-'}, local_video=${result.local_video_path || '-'}, last_frame=${result.last_frame_url || '-'}, local_last_frame=${result.local_last_frame_path || '-'}, error=${result.error ? JSON.stringify(result.error) : '-'}`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function toProviderDuration(duration) {
  return clamp(Math.round(Number(duration) || 4), 4, 12);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, '');
}

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  console.log(`Usage:
  node test/prompt-ab/run-prompt-ab-test.mjs [options]

Options:
  --mode prompt|video|both       Default: prompt
  --max-scenes <number>          Default: 2
  --product-json <path>          Optional product JSON file
  --ratio <ratio>                Default: 9:16
  --resolution <resolution>      Default: 1080p
  --poll-interval-ms <number>    Default: 5000
  --poll-attempts <number>       Default: 120
  --media-dir <path>             Default: test/vedio
  --help                         Show this help
`);
}

main().catch((error) => {
  console.error(`[prompt-ab] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
