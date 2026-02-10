# 阶段 5：多媒体与集成（P3）

**状态**: 🔲 待实施  
**前置**: 阶段 4

## 目标

图像生成、语音合成/识别、翻译服务、向量数据库/RAG、图像描述。

---

## 5.1 图像生成

### 原版实现参考

文件: `SillyTavern/src/endpoints/stable-diffusion.js`

### 支持的后端

| 后端 | 说明 |
|------|------|
| Stable Diffusion WebUI (A1111) | 本地 SD，通过 API |
| ComfyUI | 节点式工作流 |
| DALL-E (OpenAI) | OpenAI 图像生成 |
| Stability AI | Stability API |
| Pollinations | 免费 AI 图像 |
| Together AI | Together 平台 |
| Draw Things | macOS/iOS 本地 |
| NovelAI | NovelAI 图像 |

### 实现任务

**后端 `server/src/modules/media/image-gen/`**:

1. `image-gen.service.ts` — 图像生成服务（适配器模式）
2. 适配器:
   - `sd-webui.adapter.ts` — A1111/Forge API
   - `comfyui.adapter.ts` — ComfyUI WebSocket API
   - `openai-dalle.adapter.ts` — DALL-E 3
   - `stability.adapter.ts` — Stability AI API
3. 端点:
   - `POST /api/media/image/generate` — 生成图像
   - `GET /api/media/image/models` — 获取可用模型
   - `GET /api/media/image/samplers` — 获取采样器列表
   - `POST /api/media/image/caption` — 图像描述（见 5.5）

**前端**:

4. `components/media/image-gen-panel.tsx` — 图像生成面板
5. `components/media/image-gallery.tsx` — 生成历史画廊
6. 集成到聊天: AI 回复中自动/手动触发图像生成

---

## 5.2 语音合成 (TTS)

### 支持的后端

| 后端 | 说明 |
|------|------|
| ElevenLabs | 高质量 TTS API |
| Silero | 本地 TTS |
| System TTS | 浏览器 Web Speech API |
| Edge TTS | 微软 Edge TTS |
| XTTS | Coqui XTTS |
| AllTalk | AllTalk TTS 服务器 |
| OpenAI TTS | OpenAI TTS API |
| Novel AI TTS | NovelAI TTS |
| Kokoro | Kokoro TTS |

### 实现任务

**后端 `server/src/modules/media/tts/`**:

1. `tts.service.ts` — TTS 服务（适配器模式）
2. 适配器: `elevenlabs.adapter.ts`, `openai-tts.adapter.ts`, `edge-tts.adapter.ts` 等
3. 端点:
   - `POST /api/media/tts/generate` — 生成语音
   - `GET /api/media/tts/voices` — 获取可用声音列表
   - `POST /api/media/tts/stream` — 流式语音生成

**前端**:

4. `components/media/tts-controls.tsx` — 消息旁的播放按钮
5. `stores/tts-store.ts` — TTS 设置和播放状态
6. 自动朗读: AI 回复后自动播放语音（可配置）

---

## 5.3 语音识别 (STT)

### 支持的后端

| 后端 | 说明 |
|------|------|
| Browser STT | Web Speech API |
| Whisper (OpenAI) | OpenAI Whisper API |
| Whisper (本地) | 本地 Whisper 模型 |
| Vosk | Vosk 语音识别 |

### 实现任务

**后端**:

1. `server/src/modules/media/stt/stt.service.ts`
2. 端点:
   - `POST /api/media/stt/transcribe` — 音频转文字

**前端**:

3. `components/chat/voice-input.tsx` — 麦克风按钮 + 录音 UI
4. 浏览器端 Web Speech API 直接使用（无需后端）
5. Whisper 模式: 录音 → 上传 → 转写 → 填入输入框

---

## 5.4 翻译服务

### 支持的后端

| 后端 | 说明 |
|------|------|
| Google Translate | Google 翻译 API |
| DeepL | DeepL API |
| Libre Translate | 开源自托管翻译 |
| Bing Translate | 微软翻译 |
| Yandex Translate | Yandex 翻译 |

### 实现任务

**后端 `server/src/modules/media/translate/`**:

1. `translate.service.ts` — 翻译服务
2. 端点:
   - `POST /api/media/translate` — 翻译文本
   - `GET /api/media/translate/languages` — 支持的语言列表

**前端**:

3. `components/chat/translate-button.tsx` — 消息翻译按钮
4. 自动翻译模式: 输入翻译（用户语言 → 英语）+ 输出翻译（英语 → 用户语言）

---

## 5.5 图像描述 (Caption)

### 支持的后端

| 后端 | 说明 |
|------|------|
| Multimodal (LLM) | 使用多模态 LLM 描述图像 |
| Extras API | SillyTavern Extras 的 caption 模块 |

### 实现任务

**后端**:

1. `server/src/modules/media/caption/caption.service.ts`
2. 端点:
   - `POST /api/media/caption` — 图像描述
3. 支持: 直接发送图像给多模态 LLM（GPT-4V, Claude 3, Gemini）

**前端**:

4. 集成到聊天: 粘贴/上传图像 → 自动描述 → 注入到消息

---

## 5.6 向量数据库 / RAG

### 原版实现参考

文件: `SillyTavern/src/endpoints/vectors.js`

### 支持的后端

| 后端 | 说明 |
|------|------|
| Transformers (本地) | 本地嵌入模型 |
| OpenAI Embeddings | text-embedding-3-small/large |
| Cohere Embeddings | Cohere embed API |
| Extras API | SillyTavern Extras |
| Ollama | 本地 Ollama 嵌入 |
| VoyageAI | Voyage 嵌入 API |

### 实现任务

**后端 `server/src/modules/vector/`**:

1. `vector.module.ts`, `vector.controller.ts`, `vector.service.ts`
2. 嵌入适配器: `openai-embedding.adapter.ts`, `cohere-embedding.adapter.ts` 等
3. 向量存储: SQLite + 余弦相似度（小规模）或集成外部向量数据库
4. 端点:
   - `POST /api/vectors/embed` — 生成嵌入
   - `POST /api/vectors/search` — 相似度搜索
   - `POST /api/vectors/index` — 索引聊天历史/文档
   - `DELETE /api/vectors/purge` — 清除索引
5. 集成到聊天: 自动检索相关历史消息注入 prompt

**前端**:

6. `components/settings/vector-settings.tsx` — 向量设置面板
7. `stores/vector-store.ts` — 向量配置状态

---

## 验证标准

1. 配置 SD WebUI → 在聊天中生成图像 → 图像显示在消息中
2. 配置 ElevenLabs → AI 回复后自动朗读
3. 点击麦克风 → 说话 → 文字填入输入框
4. 启用翻译 → 中文输入自动翻译为英文发送 → 英文回复翻译为中文显示
5. 粘贴图像 → 自动描述 → 描述文本注入消息
6. 启用 RAG → 长对话中自动检索相关历史 → prompt 包含相关上下文
