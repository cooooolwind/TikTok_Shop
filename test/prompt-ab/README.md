# Global Brief 分镜视频 A/B 测试工具

这个目录用于独立验证“分镜视频 prompt 是否加入 Global brief”的效果差异，不会改动现有后端业务链路。

脚本流程：

1. 使用火山文本模型生成 `global_video_brief`、整体风格、叙事结构和结构化分镜。
2. 基于同一份 AI 分镜生成两组视频 prompt：
   - `baseline`：不包含 Global brief。
   - `with_global_brief`：包含 AI 生成的 Global brief。
3. 可选调用 Doubao Seedance 1.5 pro 视频模型生成真实 A/B 视频。
4. 视频模式会设置 `return_last_frame: true`，并把上一段视频的 `last_frame_url` 作为下一段的 `first_frame`。

## 环境变量

脚本会读取项目根目录 `.env`，也支持当前 shell 环境变量。

文本模型：

```bash
VOLCANO_TEXT_API_KEY=...
VOLCANO_TEXT_ENDPOINT=...
VOLCANO_TEXT_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

如果没有 `VOLCANO_TEXT_API_KEY`，会回退使用 `VOLCANO_API_KEY` 或 `ARK_API_KEY`。

视频模型：

```bash
VOLCANO_VIDEO_API_KEY=...
VOLCANO_VIDEO_ENDPOINT=...
VOLCANO_VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

如果没有 `VOLCANO_VIDEO_API_KEY`，会回退使用 `VOLCANO_API_KEY`、`ARK_API_KEY` 或 `LAS_API_KEY`。

`VOLCANO_VIDEO_ENDPOINT` 应填写 Endpoint ID。即使实际模型是 Doubao Seedance 1.5 pro，请求体里的 `model` 也使用这个 endpoint。

## 运行方式

只生成 prompt 对比，默认模式，不消耗视频额度：

```bash
node test/prompt-ab/run-prompt-ab-test.mjs --mode prompt
```

生成前 2 个分镜的真实 A/B 视频：

```bash
node test/prompt-ab/run-prompt-ab-test.mjs --mode video --max-scenes 2
```

真实视频会默认下载到 `test/vedio/<timestamp>/`，也可以通过 `--media-dir` 指定目录：

```bash
node test/prompt-ab/run-prompt-ab-test.mjs --mode video --max-scenes 2 --media-dir test/vedio
```

指定商品 JSON：

```bash
node test/prompt-ab/run-prompt-ab-test.mjs --mode prompt --product-json ./test-product.json
```

商品 JSON 示例：

```json
{
  "name": "Portable Mini Blender",
  "description": "A compact rechargeable blender for smoothies and juice.",
  "category": "kitchen appliance",
  "selling_points": ["portable", "easy to clean", "strong blending power"],
  "target_audience": "fitness users and office workers",
  "price": "$29.99",
  "images": ["https://example.com/product.png"]
}
```

如果提供 `images[0]`，第一段视频会把这张图作为 `role: first_frame`。后续分镜会使用上一段查询结果里的 `content.last_frame_url` 继续生成。

## 输出文件

每次运行会创建：

```text
test/prompt-ab/output/<timestamp>/
  ai-script.json
  prompts-baseline.json
  prompts-with-global-brief.json
  video-results.json
  report.md
```

`report.md` 会汇总两组 prompt 和视频结果。真实视频 URL 和任务 ID 只保存在 `output` 目录，该目录已加入 `.gitignore`。
生成成功的视频文件和尾帧图片会保存在 `test/vedio/`，该目录也已加入 `.gitignore`。

## 观察重点

对比 `baseline` 和 `with_global_brief` 时，建议重点看：

- 商品外观、颜色、材质是否跨分镜更一致。
- 后续分镜是否更自然地继承上一段尾帧。
- 分镜动作是否仍然聚焦当前 scene，没有被全局信息冲散。
- 多出来的时长是否用于自然停留、缓动、收尾，而不是新增剧情。

## 成本提示

`--mode prompt` 只调用文本模型。`--mode video` 和 `--mode both` 会提交真实视频生成任务，可能产生费用，并且视频 URL 和尾帧 URL 通常有有效期限制。
