# 阶段 2：核心聊天功能（P0）

**状态**: 🔲 待实施  
**前置**: 阶段 1 ✅

## 目标

能选角色、发消息、收到 AI 流式回复。完整的聊天生命周期。

---

## 2.1 TavernCard V2 PNG 解析与导入

### 原版实现参考

文件: `SillyTavern/src/character-card-parser.js`

PNG 元数据通过 `tEXt` chunk 存储，关键字为 `chara`（V2）或 `ccv3`（V3）。数据为 Base64 编码的 JSON。

### TavernCard V2 完整字段

```typescript
interface TavernCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    // 核心字段
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;

    // 元信息
    creator_notes: string;
    creator: string;
    character_version: string;
    tags: string[];

    // 提示词控制
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];

    // SillyTavern 扩展字段
    extensions: {
      talkativeness: number;       // 0-1, 默认 0.5
      fav: boolean;
      world: string;               // 关联的世界信息文件
      depth_prompt: {
        prompt: string;
        depth: number;             // 默认 4
        role: 'system' | 'user' | 'assistant';  // 默认 system
      };
    };

    // 角色书（内嵌世界信息）
    character_book?: {
      entries: WorldInfoEntry[];
    };
  };
}
```

### 实现任务

**后端 `server/src/modules/character/`**:

1. 新增 `character-card-parser.service.ts`:
   - 依赖: `png-chunks-extract`, `png-chunks-encode`, `png-chunk-text`
   - `read(buffer: Buffer): TavernCardV2` — 从 PNG 提取角色数据
   - `write(buffer: Buffer, data: TavernCardV2): Buffer` — 写入角色数据到 PNG
   - 读取优先级: `ccv3` > `chara`

2. 扩展 `character.controller.ts` 新增端点:
   - `POST /api/characters/import` — 接受 PNG/JSON/YAML 文件上传，解析后入库
   - `POST /api/characters/export/:id` — 导出为 PNG（元数据嵌入）或 JSON
   - `POST /api/characters/duplicate/:id` — 复制角色
   - `PATCH /api/characters/:id/avatar` — 单独更新头像（支持裁剪）

3. 扩展 `characters` 表字段:
   ```sql
   ALTER TABLE characters ADD COLUMN system_prompt TEXT DEFAULT '';
   ALTER TABLE characters ADD COLUMN post_history_instructions TEXT DEFAULT '';
   ALTER TABLE characters ADD COLUMN alternate_greetings TEXT DEFAULT '[]';  -- JSON array
   ALTER TABLE characters ADD COLUMN creator TEXT DEFAULT '';
   ALTER TABLE characters ADD COLUMN creator_notes TEXT DEFAULT '';
   ALTER TABLE characters ADD COLUMN character_version TEXT DEFAULT '';
   ALTER TABLE characters ADD COLUMN tags TEXT DEFAULT '[]';               -- JSON array
   ALTER TABLE characters ADD COLUMN extensions TEXT DEFAULT '{}';         -- JSON object
   ALTER TABLE characters ADD COLUMN character_book TEXT DEFAULT NULL;     -- JSON object
   ```

4. 头像文件存储: `server/data/characters/{id}.png`

**前端**:

5. `components/character/character-import.tsx` — 拖拽/点击上传 PNG 卡片
6. `components/character/character-editor.tsx` — 完整角色编辑表单（所有 V2 字段）
7. `components/character/character-export.tsx` — 导出对话框

---

## 2.2 AI 提供商适配器完善

### 原版实现参考

文件: `SillyTavern/src/endpoints/backends/chat-completions.js`

### 请求参数（完整）

```typescript
interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
  top_p: number;
  top_k?: number;                    // Anthropic/Google
  stream: boolean;
  stop?: string[];
  frequency_penalty?: number;        // OpenAI
  presence_penalty?: number;         // OpenAI
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: string; function: { name: string } };
  assistant_prefill?: string;        // Anthropic prefill
  json_schema?: { name: string; description: string; value: object };
  reasoning_effort?: string;         // o1/o3 models
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

### 实现任务

**后端 `server/src/modules/ai-provider/`**:

1. 完善现有适配器:
   - `openai.adapter.ts` — 添加 function calling, json_schema, frequency/presence_penalty
   - `anthropic.adapter.ts` — 添加 system prompt 数组格式, assistant_prefill, thinking/extended thinking
   - `google.adapter.ts` — 添加 Gemini 特有参数 (safety_settings, generation_config)

2. 新增适配器:
   - `openrouter.adapter.ts` — OpenRouter 统一接口（兼容 OpenAI 格式 + 额外 header）
   - `mistral.adapter.ts` — Mistral AI
   - `custom.adapter.ts` — 自定义 OpenAI 兼容端点（reverse proxy）

3. 流式传输改进:
   - 当前: SSE 直接 pipe
   - 改进: 服务端解析每个 chunk，统一格式后转发
   - 添加 AbortController，客户端断开时中止上游请求
   - 错误处理: 流中途出错时发送 `[ERROR]` 事件

4. Token 计数端点:
   - `POST /api/ai-provider/tokenize` — 使用 tiktoken (OpenAI) 或近似算法计数
   - `GET /api/ai-provider/models` — 返回各提供商可用模型列表 + context window 大小

---

## 2.3 聊天核心流程

### 原版实现参考

文件: `SillyTavern/public/script.js` — `Generate()` 函数

### 生成类型

```typescript
type GenerationType = 
  | 'normal'      // 正常发送消息 + AI 回复
  | 'regenerate'  // 重新生成最后一条 AI 回复
  | 'swipe'       // 生成替代回复（左右滑动）
  | 'continue'    // 继续上一条消息
  | 'impersonate' // 以用户身份生成
  | 'quiet';      // 静默生成（不更新 UI）
```

### 消息数据结构

```typescript
interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
  is_user: boolean;
  send_date: string;          // ISO timestamp
  gen_started?: string;       // 生成开始时间
  gen_finished?: string;      // 生成结束时间
  swipe_id?: number;          // 当前 swipe 索引
  swipes?: string[];          // 所有 swipe 内容
  swipe_info?: SwipeInfo[];   // 每个 swipe 的元信息
  extra?: {
    title?: string;
    media?: MediaItem[];
    tool_invocations?: ToolInvocation[];
  };
}
```

### Prompt 组装流程

原版 `prepareOpenAIMessages()` 的逻辑:

```
1. 设置 token 预算 = max_context - max_tokens
2. 按优先级添加 prompt 组件:
   ┌─────────────────────────────────────┐
   │ System Prompt (最高优先级)           │
   │ Character Description               │
   │ Character Personality               │
   │ Scenario                            │
   │ World Info (Before)                 │
   │ Example Messages                    │
   │ ─── 聊天历史（从新到旧） ───        │
   │ World Info (After)                  │
   │ Author's Note / Depth Prompts       │
   │ Jailbreak Prompt                    │
   └─────────────────────────────────────┘
3. 从最旧的聊天消息开始裁剪，直到 token 预算内
4. 合并连续的 system 消息（可选）
```

### 实现任务

**后端**:

1. `server/src/modules/chat/prompt-builder.service.ts`:
   - `buildPrompt(character, chat, messages, settings, worldInfo?): ChatMessage[]`
   - 实现上述 prompt 组装逻辑
   - Token 预算管理（按优先级裁剪）
   - 宏替换: `{{char}}`, `{{user}}`, `{{random}}`, `{{time}}`, `{{date}}` 等

2. 扩展 `chat.controller.ts`:
   - `POST /api/chat/:chatId/generate` — 触发 AI 生成
     - Body: `{ type: GenerationType, message?: string }`
     - 返回: SSE 流
   - `POST /api/chat/:chatId/stop` — 中止生成
   - `PUT /api/messages/:id/swipe` — 添加/切换 swipe

3. 扩展 `messages` 表:
   ```sql
   ALTER TABLE messages ADD COLUMN swipes TEXT DEFAULT '[]';       -- JSON array
   ALTER TABLE messages ADD COLUMN swipe_id INTEGER DEFAULT 0;
   ALTER TABLE messages ADD COLUMN gen_started TEXT;
   ALTER TABLE messages ADD COLUMN gen_finished TEXT;
   ALTER TABLE messages ADD COLUMN extra TEXT DEFAULT '{}';
   ```

**前端**:

4. 重构 `stores/chat-store.ts`:
   - `generate(type, message?)` — 调用生成 API，处理 SSE 流
   - `stopGeneration()` — 中止
   - `swipe(messageId, direction)` — 左右滑动切换回复
   - `regenerate()` — 重新生成
   - `continueMessage()` — 继续生成
   - `impersonate()` — 以用户身份生成

5. `components/chat/message-bubble.tsx` 增强:
   - Swipe 指示器（左右箭头 + 计数）
   - 消息操作菜单（编辑、删除、复制、重新生成）
   - 流式打字效果
   - Markdown 渲染（支持代码块高亮）

6. `components/chat/chat-input.tsx` 增强:
   - 发送按钮 / 停止按钮切换
   - Continue / Impersonate / Regenerate 快捷按钮
   - 输入框自动调整高度

7. `components/chat/streaming-text.tsx`:
   - 逐字/逐 token 显示效果
   - 光标闪烁动画

---

## 2.4 角色管理前端

### 实现任务

1. `components/character/character-list.tsx`:
   - 网格/列表视图切换
   - 搜索过滤
   - 排序（名称、日期、最近聊天）
   - 收藏标记

2. `components/character/character-card.tsx` 增强:
   - 头像显示
   - 名称 + 创建者
   - 最近聊天时间
   - 收藏星标
   - 右键菜单（编辑、复制、导出、删除）

3. `components/character/character-editor.tsx`:
   - 标签页: 基本信息 / 高级设置 / 角色书
   - 字段: name, description, personality, scenario, first_mes, mes_example
   - 高级: system_prompt, post_history_instructions, alternate_greetings, depth_prompt
   - 头像上传 + 裁剪
   - 保存/取消

4. `components/sidebar/sidebar.tsx` 增强:
   - 角色列表 / 聊天列表 标签切换
   - 新建角色按钮
   - 导入角色按钮
   - 聊天列表显示当前角色的所有聊天

---

## 2.5 设置面板完善

### 实现任务

1. `components/settings/settings-panel.tsx` 增强:
   - API 连接设置（提供商选择、API Key、自定义端点）
   - 模型选择（按提供商分组）
   - 采样参数（temperature, top_p, top_k, max_tokens, frequency_penalty, presence_penalty）
   - 预设管理（保存/加载/删除预设）
   - 连接测试按钮

2. `stores/connection-store.ts` 增强:
   - 多 API Key 管理
   - 自定义端点 URL
   - 连接状态检测

---

## 验证标准

1. 导入原版 TavernCard V2 PNG → 角色数据正确解析并显示
2. 创建角色 → 填写所有字段 → 保存 → 重新打开数据完整
3. 选择角色 → 发送消息 → 收到 AI 流式回复
4. Swipe 左右切换 → 显示不同回复
5. Regenerate → 重新生成最后回复
6. Continue → 继续上一条消息
7. 切换 AI 提供商 → 均能正常对话
8. 保存/加载采样预设 → 参数正确应用
9. 导出角色为 PNG → 重新导入数据一致
