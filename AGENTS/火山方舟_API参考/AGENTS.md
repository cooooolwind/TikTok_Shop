# 火山方舟 (Volcano Ark) API Reference Guide for AI Agents

This directory contains local documentation for Volcano Engine's Ark (火山方舟) platform. To utilize these resources efficiently, follow these guidelines.

## Directory Structure Overview

The documentation is organized numerically by feature area:
- **`1. 准备工作`**: Setup, API keys, SDK installation, and Authentication.
- **`2. 对话(Chat) API`**: Standard LLM chat completion interfaces.
- **`3. Responses API`**: Specialized API for multimodal and complex reasoning outputs.
- **`4. Files API`**: Management of assets for multimodal analysis.
- **`5-7. Generation APIs`**: Video, Image, and 3D generation.
- **`9. 上下文缓存 (Context Caching)`**: Optimization for long-context tasks.
- **`10. 应用(Bot) API`**: High-level Bot and Plugin (Search, Knowledge Base) interfaces.
- **`16. 其他说明`**: OpenAI SDK compatibility and error codes.

## AI Navigation Strategy

### 1. Identify the Requirement
Before diving into the docs, determine which specific Volcano Ark feature you need:
- Standard text generation -> `2. 对话(Chat) API`
- Multimodal analysis (Video/Image input) -> `3. Responses API` (Note: This is often preferred over standard Chat for file inputs).
- Uploading assets for analysis -> `4. Files API`.
- Video generation -> `5. 视频生成 API`.

### 2. Check OpenAI Compatibility
Volcano Ark is mostly compatible with OpenAI SDKs. Refer to `16.1 兼容 OpenAI SDK.md` to see how to map standard `openai` library calls to Volcano endpoints.

### 3. Authentication & Base URL
Always verify the Base URL and headers in `1.3 Base URL及鉴权.md`.
- **Base URL**: `https://ark.cn-beijing.volces.com/api/v3`
- **Auth**: `Authorization: Bearer <API_KEY>`

### 4. Implementation Reference
If you need code snippets, check `16.3 SDK 常见使用示例.md` first. It often contains the most direct "how-to" for common patterns.

## Best Practices for AI Processing

- **Context Preservation**: When implementing a feature, reference the specific Markdown file name in your comments so future agents can find the source of the logic.
- **Responses API vs Chat API**: For modern multimodal tasks (like the video slicing in this project), prioritize the **Responses API** (`3. Responses API`) as it handles `file_id` inputs more natively than the legacy Chat completion.
- **Error Handling**: Consult `16.2 错误码.md` when debugging API failures to distinguish between rate limits (429), auth issues (401), and internal errors.
