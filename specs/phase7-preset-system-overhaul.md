# 阶段 7：预设系统全面重做（P1）

**状态**: 🔲 待实施
**前置**: 阶段 2 ✅（核心聊天功能）

## 目标

将当前简化的预设系统替换为与原版 SillyTavern 完全兼容的实现。支持全部 8 种预设类型，原版预设 JSON 文件可直接导入使用，Prompt 排序与预设联动并实际作用于后端生成流程。

---

## 背景与现状分析

### 原版酒馆预设系统

- **文件存储**：每个预设是独立 `.json` 文件，按类型分目录（`OpenAI Settings/`, `KoboldAI Settings/`, `instruct/` 等）
- **8 种预设类型**：`openai`, `kobold`, `novel`, `textgen`, `instruct`, `context`, `sysprompt`, `reasoning`
- **3 个端点**：`/save`, `/delete`, `/restore`（恢复为内置默认值）
- **内置默认预设**：约 125 个 JSON 文件，首次启动自动 seed 到用户目录
- **OpenAI 预设最复杂**：100+ 个字段，包含 `prompts` 数组（提示词组件定义）和 `prompt_order` 数组（组装顺序），这些直接控制 Prompt 组装流程

### 当前重写版现状

- 单表 `presets`，`data` 字段只存 8 个采样参数
- Prompt Manager（`prompt-manager-store.ts`）是纯前端装饰，**不影响后端生成**
- `PromptBuilderService` 组装顺序**硬编码**，不读取任何用户偏好
- 无导入/导出、无内置默认预设、无 instruct/context/sysprompt 预设类型

---

## 7.1 数据库 Schema 变更

文件: `server/src/db/drizzle.service.ts`

在 `ensureSchemaMigrations()` 中添加：

```sql
-- 新增列
ALTER TABLE presets ADD COLUMN is_default INTEGER DEFAULT 0;
ALTER TABLE presets ADD COLUMN source_hash TEXT DEFAULT NULL;

-- 唯一约束（防止同类型同名重复）
CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_name_type ON presets(name, api_type);
```

字段说明：
- `is_default`: 1 = 内置默认预设（不可删除，可恢复）
- `source_hash`: 内置预设原始 JSON 的 SHA-256 哈希，用于 restore 时检测用户是否修改过
- `api_type` 扩展为 8 种：`openai`, `kobold`, `novel`, `textgen`, `instruct`, `context`, `sysprompt`, `reasoning`
- `data` 字段存储**完整的原版 JSON blob**，不做字段拆解

扩展后的 Row 接口：

```typescript
export interface PresetRow {
  id: number;
  name: string;
  api_type: string;       // 'openai' | 'kobold' | 'novel' | 'textgen' | 'instruct' | 'context' | 'sysprompt' | 'reasoning'
  data: string;           // 完整 JSON blob 字符串
  is_default: number;     // 0 | 1
  source_hash: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## 7.2 内置默认预设

### 目录结构

创建 `server/src/modules/preset/defaults/`，从原版 `default/content/presets/` 拷贝：

```
server/src/modules/preset/defaults/
├── openai/
│   └── Default.json           # 原版 OpenAI 默认预设
├── kobold/
│   ├── Deterministic.json
│   ├── Neutral.json
│   ├── Universal-Creative.json
│   ├── Universal-Light.json
│   └── Universal-Super-Creative.json
├── novel/
│   ├── Fresh-Coffee-Kayra.json
│   ├── Edgewise-Clio.json
│   ├── Erato-Dragonfruit.json
│   └── ... (全部 NovelAI 预设)
├── textgen/
│   ├── Default.json
│   ├── Deterministic.json
│   ├── Neutral.json
│   ├── Universal-Creative.json
│   ├── Universal-Light.json
│   └── Universal-Super-Creative.json
├── instruct/
│   ├── ChatML.json
│   ├── ChatML-Names.json
│   ├── Llama 3 Instruct.json
│   ├── Alpaca.json
│   └── ... (全部 instruct 模板)
├── context/
│   ├── Default.json
│   ├── ChatML.json
│   ├── Minimalist.json
│   └── ... (全部 context 模板)
├── sysprompt/
│   ├── Blank.json
│   ├── Actor.json
│   ├── Roleplay - Simple.json
│   ├── Roleplay - Detailed.json
│   ├── Writer - Creative.json
│   └── ... (全部 sysprompt 预设)
└── reasoning/
    ├── Blank.json
    ├── DeepSeek.json
    └── OpenAI Harmony.json
```

### Seed 逻辑

新建 `server/src/modules/preset/default-presets.ts`：

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface DefaultPresetFile {
  name: string;        // 文件名去掉 .json
  apiType: string;     // 目录名
  data: string;        // 原始 JSON 字符串
  hash: string;        // SHA-256
}

/**
 * 扫描 defaults/ 目录，读取所有预设文件
 */
export function loadDefaultPresets(): DefaultPresetFile[] {
  const defaultsDir = path.join(__dirname, 'defaults');
  const results: DefaultPresetFile[] = [];

  for (const typeDir of fs.readdirSync(defaultsDir)) {
    const typePath = path.join(defaultsDir, typeDir);
    if (!fs.statSync(typePath).isDirectory()) continue;

    for (const file of fs.readdirSync(typePath)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(typePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      results.push({
        name: path.parse(file).name,
        apiType: typeDir,
        data: content,
        hash,
      });
    }
  }

  return results;
}
```

在 `PresetService` 中实现 `OnModuleInit`：

```typescript
@Injectable()
export class PresetService implements OnModuleInit {
  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults(): Promise<void> {
    const defaults = loadDefaultPresets();
    for (const preset of defaults) {
      const existing = await this.findByNameAndType(preset.name, preset.apiType);
      if (!existing) {
        this.db.run(
          'INSERT INTO presets (name, api_type, data, is_default, source_hash) VALUES (?, ?, ?, 1, ?)',
          [preset.name, preset.apiType, preset.data, preset.hash],
        );
      }
    }
  }
}
```

---

## 7.3 各预设类型的 JSON Schema 参考

### 7.3.1 OpenAI 预设（最复杂）

原版 `OpenAI Settings/Default.json`，100+ 个顶级字段：

```typescript
interface OpenAIPresetData {
  // === 提供商 & 模型选择 ===
  chat_completion_source: string;      // 'openai' | 'claude' | 'google' | 'openrouter' | 'mistralai' | 'custom' | ...
  openai_model: string;
  claude_model: string;
  google_model: string;
  vertexai_model: string;
  openrouter_model: string;
  mistralai_model: string;
  custom_model: string;
  ai21_model: string;
  cohere_model: string;
  perplexity_model: string;
  groq_model: string;
  deepseek_model: string;
  // ... 其他子提供商模型字段

  // === 采样参数 ===
  temperature: number;
  frequency_penalty: number;
  presence_penalty: number;
  top_p: number;
  top_k: number;
  top_a: number;
  min_p: number;
  repetition_penalty: number;
  seed: number;
  n: number;

  // === 上下文控制 ===
  openai_max_context: number;
  openai_max_tokens: number;
  max_context_unlocked: boolean;

  // === 流式 ===
  stream_openai: boolean;

  // === 提示词模板 ===
  impersonation_prompt: string;
  new_chat_prompt: string;
  new_group_chat_prompt: string;
  new_example_chat_prompt: string;
  continue_nudge_prompt: string;
  group_nudge_prompt: string;
  send_if_empty: string;

  // === 格式化字符串 ===
  wi_format: string;
  scenario_format: string;
  personality_format: string;

  // === 提供商特定设置 ===
  assistant_prefill: string;
  assistant_impersonation: string;
  use_sysprompt: boolean;
  squash_system_messages: boolean;
  media_inlining: boolean;
  bypass_status_check: boolean;
  continue_prefill: boolean;
  continue_postfix: string;

  // === 功能开关 ===
  names_behavior: number;             // 0=none, 1=completion, 2=content
  bias_preset_selected: string;
  show_external_models: boolean;
  function_calling: boolean;
  show_thoughts: boolean;
  reasoning_effort: string;
  enable_web_search: boolean;

  // === OpenRouter 特定 ===
  openrouter_use_fallback: boolean;
  openrouter_group_models: boolean;
  openrouter_sort_models: string;
  openrouter_providers: unknown[];
  openrouter_quantizations: unknown[];
  openrouter_allow_fallbacks: boolean;

  // === 代理 ===
  reverse_proxy: string;
  proxy_password: string;

  // === Custom API ===
  custom_url: string;
  custom_include_body: string;
  custom_exclude_body: string;
  custom_include_headers: string;

  // === 图片相关 ===
  inline_image_quality: string;
  request_images: boolean;
  request_image_aspect_ratio: string;
  request_image_resolution: string;

  // === Azure ===
  azure_base_url: string;
  azure_deployment_name: string;
  azure_api_version: string;
  azure_openai_model: string;

  // ========================================
  // === 核心：提示词组件定义 + 排序 ===
  // ========================================
  prompts: PromptEntry[];
  prompt_order: PromptOrderEntry[];

  // === 扩展数据 ===
  extensions?: Record<string, unknown>;
}

/** 提示词组件定义 */
interface PromptEntry {
  identifier: string;        // 唯一标识符：'main', 'nsfw', 'jailbreak', 'chatHistory', 'worldInfoBefore', etc.
  name: string;              // 显示名称
  system_prompt: boolean;    // 是否为系统级提示词
  role: 'system' | 'user' | 'assistant';
  content?: string;          // 可编辑的提示词内容（marker 类型无此字段）
  marker?: boolean;          // true = 结构性占位符（chatHistory, worldInfoBefore 等）
}

/** 提示词排序定义 */
interface PromptOrderEntry {
  character_id: number;      // 100000 = 默认，100001 = 全局
  order: Array<{
    identifier: string;      // 对应 PromptEntry.identifier
    enabled: boolean;
  }>;
}
```

**原版 Default.json 的默认 prompts 数组**（12 个组件）：

| identifier | name | 类型 | 说明 |
|---|---|---|---|
| `main` | Main Prompt | 可编辑 | 主系统提示词 |
| `nsfw` | Auxiliary Prompt | 可编辑 | 辅助提示词（NSFW 等） |
| `dialogueExamples` | Chat Examples | marker | 示例对话插入位置 |
| `jailbreak` | Post-History Instructions | 可编辑 | 聊天历史后的指令 |
| `chatHistory` | Chat History | marker | 聊天历史插入位置 |
| `worldInfoAfter` | World Info (after) | marker | 世界信息（后）插入位置 |
| `worldInfoBefore` | World Info (before) | marker | 世界信息（前）插入位置 |
| `enhanceDefinitions` | Enhance Definitions | 可编辑 | 增强角色定义 |
| `charDescription` | Char Description | marker | 角色描述插入位置 |
| `charPersonality` | Char Personality | marker | 角色性格插入位置 |
| `scenario` | Scenario | marker | 场景插入位置 |
| `personaDescription` | Persona Description | marker | 用户人设插入位置 |

**默认 prompt_order（character_id: 100000）**：

```
main → worldInfoBefore → charDescription → charPersonality → scenario →
enhanceDefinitions(disabled) → nsfw → worldInfoAfter → dialogueExamples →
chatHistory → jailbreak → personaDescription
```

### 7.3.2 KoboldAI 预设

```typescript
interface KoboldPresetData {
  temp: number;
  rep_pen: number;
  rep_pen_range: number;
  top_p: number;
  min_p: number;
  top_a: number;
  top_k: number;
  typical: number;
  tfs: number;
  rep_pen_slope: number;
  sampler_order: number[];     // [6, 0, 1, 3, 4, 2, 5]
  mirostat: number;            // 0=off, 1=v1, 2=v2
  mirostat_tau: number;
  mirostat_eta: number;
  use_default_badwordsids: boolean;
  grammar: string;
}
```

### 7.3.3 TextGen 预设

```typescript
interface TextGenPresetData {
  // 基础采样
  temp: number;
  temperature_last: boolean;
  top_p: number;
  top_k: number;
  top_a: number;
  tfs: number;
  typical_p: number;
  min_p: number;

  // 重复惩罚
  rep_pen: number;
  rep_pen_range: number;
  rep_pen_decay: number;
  rep_pen_slope: number;
  no_repeat_ngram_size: number;
  freq_pen: number;
  presence_pen: number;

  // 高级采样
  epsilon_cutoff: number;
  eta_cutoff: number;
  penalty_alpha: number;
  num_beams: number;
  length_penalty: number;
  min_length: number;
  encoder_rep_pen: number;
  skew: number;

  // 动态温度
  dynatemp: boolean;
  min_temp: number;
  max_temp: number;
  dynatemp_exponent: number;

  // 平滑采样
  smoothing_factor: number;
  smoothing_curve: number;

  // DRY 采样
  dry_allowed_length: number;
  dry_multiplier: number;
  dry_base: number;
  dry_sequence_breakers: string;   // JSON 字符串
  dry_penalty_last_n: number;

  // Token 控制
  add_bos_token: boolean;
  ban_eos_token: boolean;
  skip_special_tokens: boolean;
  do_sample: boolean;
  early_stopping: boolean;

  // Mirostat
  mirostat_mode: number;
  mirostat_tau: number;
  mirostat_eta: number;

  // XTC
  xtc_threshold: number;
  xtc_probability: number;

  // 其他
  guidance_scale: number;
  negative_prompt: string;
  grammar_string: string;
  json_schema: unknown | null;
  banned_tokens: string;
  nsigma: number;
  seed: number;

  // 采样器优先级
  sampler_priority: string[];
  samplers: string[];
  sampler_order: number[];
  logit_bias: unknown[];
}
```

### 7.3.4 Instruct 预设

```typescript
interface InstructPresetData {
  name: string;
  input_sequence: string;           // e.g. "<|im_start|>user"
  output_sequence: string;          // e.g. "<|im_start|>assistant"
  system_sequence: string;          // e.g. "<|im_start|>system"
  stop_sequence: string;            // e.g. "<|im_end|>"
  first_output_sequence: string;
  last_output_sequence: string;
  first_input_sequence: string;
  last_input_sequence: string;
  last_system_sequence: string;
  input_suffix: string;             // e.g. "<|im_end|>\n"
  output_suffix: string;
  system_suffix: string;
  wrap: boolean;
  macro: boolean;
  names_behavior: string;           // 'force' | 'never' | 'auto'
  activation_regex: string;
  skip_examples: boolean;
  user_alignment_message: string;
  system_same_as_user: boolean;
  sequences_as_stop_strings: boolean;
  story_string_prefix: string;
  story_string_suffix: string;
}
```

### 7.3.5 Context 预设

```typescript
interface ContextPresetData {
  name: string;
  story_string: string;             // Handlebars 模板，如 "{{#if system}}{{system}}\n{{/if}}..."
  example_separator: string;        // 通常 "***"
  chat_start: string;               // 通常 "***"
  use_stop_strings: boolean;
  names_as_stop_strings: boolean;
  story_string_position: number;    // 0=before chat, 1=in-chat
  story_string_depth: number;
  story_string_role: number;        // 0=system, 1=user, 2=assistant
  always_force_name2: boolean;
  trim_sentences: boolean;
  single_line: boolean;
}
```

### 7.3.6 System Prompt 预设

```typescript
interface SyspromptPresetData {
  name: string;
  content: string;                  // 系统提示词内容
  post_history: string;             // 聊天历史后的追加指令
}
```

### 7.3.7 Reasoning 预设

```typescript
interface ReasoningPresetData {
  name: string;
  prefix: string;                   // 思考开始标记
  suffix: string;                   // 思考结束标记
  separator: string;                // 思考与回复的分隔符
}
```

---

## 7.4 Provider 映射

新建 `server/src/modules/preset/provider-mapping.ts` 和 `client/lib/provider-mapping.ts`（共享逻辑）：

```typescript
/** 原版 chat_completion_source → 重写版 Provider */
export const ST_SOURCE_TO_PROVIDER: Record<string, string> = {
  openai: 'openai',
  chatgpt: 'openai',
  claude: 'anthropic',
  google: 'google',
  makersuite: 'google',
  openrouter: 'openrouter',
  mistralai: 'mistral',
  custom: 'custom',
  // 以下原版子提供商映射到 custom（重写版暂不原生支持）
  ai21: 'custom',
  cohere: 'custom',
  perplexity: 'custom',
  groq: 'custom',
  deepseek: 'custom',
  xai: 'custom',
  chutes: 'custom',
  electronhub: 'custom',
};

/** 原版模型字段名 → 重写版 Provider */
export const MODEL_FIELD_TO_PROVIDER: Record<string, string> = {
  openai_model: 'openai',
  claude_model: 'anthropic',
  google_model: 'google',
  vertexai_model: 'google',
  openrouter_model: 'openrouter',
  mistralai_model: 'mistral',
  custom_model: 'custom',
};

/**
 * 从 OpenAI 预设数据中提取当前激活的 provider 和 model
 */
export function resolveProviderAndModel(
  presetData: Record<string, unknown>,
): { provider: string; model: string } {
  const source = (presetData.chat_completion_source as string) ?? 'openai';
  const provider = ST_SOURCE_TO_PROVIDER[source] ?? 'custom';

  const modelFieldMap: Record<string, string> = {
    openai: 'openai_model',
    anthropic: 'claude_model',
    google: 'google_model',
    openrouter: 'openrouter_model',
    mistral: 'mistralai_model',
    custom: 'custom_model',
  };

  const modelField = modelFieldMap[provider] ?? 'custom_model';
  const model = (presetData[modelField] as string) ?? '';

  return { provider, model };
}
```

---

## 7.5 后端 Service 扩展

文件: `server/src/modules/preset/preset.service.ts`

### 新增方法

```typescript
/** 按名称+类型查找（用于 upsert 和 seed） */
async findByNameAndType(name: string, apiType: string): Promise<PresetRow | null> {
  return this.db.get<PresetRow>(
    'SELECT * FROM presets WHERE name = ? AND api_type = ?',
    [name, apiType],
  );
}

/** 导入预设 — 存储完整 JSON blob */
async importPreset(name: string, apiType: string, data: Record<string, unknown>): Promise<PresetRow> {
  const existing = await this.findByNameAndType(name, apiType);
  if (existing) {
    // 已存在则更新
    this.db.run(
      "UPDATE presets SET data = ?, updated_at = datetime('now') WHERE id = ?",
      [JSON.stringify(data), existing.id],
    );
    return (await this.findOne(existing.id))!;
  }
  return this.create({ name, apiType, data: JSON.stringify(data) });
}

/** 导出预设 — 返回解析后的 JSON */
async exportPreset(id: number): Promise<{ name: string; apiType: string; data: Record<string, unknown> } | null> {
  const preset = await this.findOne(id);
  if (!preset) return null;
  return {
    name: preset.name,
    apiType: preset.api_type,
    data: JSON.parse(preset.data),
  };
}

/** 恢复默认预设 */
async restore(id: number): Promise<{ isDefault: boolean; preset: Record<string, unknown> }> {
  const preset = await this.findOne(id);
  if (!preset || !preset.is_default) {
    return { isDefault: false, preset: {} };
  }

  // 从 defaults/ 目录读取原始文件
  const defaults = loadDefaultPresets();
  const original = defaults.find(d => d.name === preset.name && d.apiType === preset.api_type);

  if (!original) {
    return { isDefault: true, preset: {} };
  }

  // 恢复数据
  this.db.run(
    "UPDATE presets SET data = ?, source_hash = ?, updated_at = datetime('now') WHERE id = ?",
    [original.data, original.hash, id],
  );

  return { isDefault: true, preset: JSON.parse(original.data) };
}

/** 获取某类型的所有默认预设名 */
async getDefaultNames(apiType: string): Promise<string[]> {
  const rows = await this.db.query<{ name: string }>(
    'SELECT name FROM presets WHERE api_type = ? AND is_default = 1',
    [apiType],
  );
  return rows.map(r => r.name);
}
```

### 修改现有方法

`remove()` 需要检查 `is_default`：

```typescript
async remove(id: number): Promise<PresetRow | null> {
  const preset = await this.findOne(id);
  if (!preset) return null;
  if (preset.is_default) {
    throw new BadRequestException('Cannot delete default preset. Use restore instead.');
  }
  this.db.run('DELETE FROM presets WHERE id = ?', [id]);
  return preset;
}
```

`update()` 需要在修改默认预设时清除 `source_hash`：

```typescript
async update(id: number, data: Record<string, unknown>): Promise<PresetRow | null> {
  // ... 现有逻辑 ...
  // 如果是默认预设被修改，清除 source_hash
  const existing = await this.findOne(id);
  if (existing?.is_default) {
    sets.push('source_hash = NULL');
  }
  // ... 执行 UPDATE ...
}
```

---

## 7.6 后端 Controller 扩展

文件: `server/src/modules/preset/preset.controller.ts`

新增端点：

```typescript
/** 导入预设 */
@Post('import')
async importPreset(@Body() body: { name: string; apiType: string; data: Record<string, unknown> }) {
  return this.presetService.importPreset(body.name, body.apiType, body.data);
}

/** 导出预设为 JSON */
@Get(':id/export')
async exportPreset(@Param('id', ParseIntPipe) id: number) {
  const result = await this.presetService.exportPreset(id);
  if (!result) throw new NotFoundException('Preset not found');
  return result;
}

/** 恢复默认预设 */
@Post(':id/restore')
async restore(@Param('id', ParseIntPipe) id: number) {
  const existing = await this.presetService.findOne(id);
  if (!existing) throw new NotFoundException('Preset not found');
  return this.presetService.restore(id);
}

/** 获取某类型的默认预设列表 */
@Get('defaults/:apiType')
async getDefaults(@Param('apiType') apiType: string) {
  return this.presetService.getDefaultNames(apiType);
}
```

---

## 7.7 预设类型自动检测

新建 `client/lib/preset-type-detector.ts`：

```typescript
/**
 * 根据 JSON 的键特征自动判断预设类型
 * 用于导入时自动分类
 */
export function detectPresetType(data: Record<string, unknown>): string | null {
  // OpenAI：有 chat_completion_source 或 prompts 数组
  if ('chat_completion_source' in data || 'prompts' in data) return 'openai';

  // Instruct：有 input_sequence + output_sequence
  if ('input_sequence' in data && 'output_sequence' in data) return 'instruct';

  // Context：有 story_string（Handlebars 模板）
  if ('story_string' in data) return 'context';

  // Sysprompt：有 content + post_history，且键数少
  if ('content' in data && 'post_history' in data && Object.keys(data).length <= 5) return 'sysprompt';

  // Reasoning：有 prefix + suffix + separator
  if ('prefix' in data && 'suffix' in data && 'separator' in data) return 'reasoning';

  // TextGen：有 temperature_last 或 sampler_priority 数组
  if ('temperature_last' in data || 'sampler_priority' in data) return 'textgen';

  // NovelAI：有 phrase_rep_pen 或 repetition_penalty_frequency
  if ('phrase_rep_pen' in data || 'repetition_penalty_frequency' in data) return 'novel';

  // KoboldAI：有 temp + rep_pen + sampler_order（最宽泛，放最后）
  if ('temp' in data && 'rep_pen' in data && 'sampler_order' in data) return 'kobold';

  return null;
}
```

---

## 7.8 前端 Store 改造

### 7.8.1 新建 `client/stores/preset-store.ts`

替代 `settings-panel.tsx` 中的内联预设逻辑：

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { presetApi, type Preset } from "@/lib/api";

interface PresetState {
  /** 按 api_type 分组的预设列表 */
  presets: Record<string, Preset[]>;

  /** 每种类型当前激活的预设 ID */
  activePresetId: Record<string, number | null>;

  /** 加载指定类型的预设列表 */
  loadPresets: (apiType: string) => Promise<void>;

  /** 选择激活预设 */
  selectPreset: (apiType: string, presetId: number | null) => void;

  /** 保存新预设 */
  savePreset: (name: string, apiType: string, data: Record<string, unknown>) => Promise<Preset>;

  /** 更新预设数据 */
  updatePreset: (id: number, apiType: string, data: Record<string, unknown>) => Promise<void>;

  /** 删除预设 */
  deletePreset: (id: number, apiType: string) => Promise<void>;

  /** 导入预设（从 JSON 文件） */
  importPreset: (name: string, apiType: string, jsonData: Record<string, unknown>) => Promise<Preset>;

  /** 恢复默认预设 */
  restorePreset: (id: number, apiType: string) => Promise<void>;

  /**
   * 应用预设 — 将预设数据写入 connection-store 和 prompt-manager-store
   * 这是核心方法，负责把 JSON blob 中的各字段分发到对应的 store
   */
  applyPreset: (preset: Preset) => void;

  /**
   * 收集当前设置 — 从 connection-store 和 prompt-manager-store 收集数据
   * 用于保存预设时组装 JSON blob
   */
  collectCurrentSettings: (apiType: string) => Record<string, unknown>;
}
```

`applyPreset` 的实现逻辑（以 OpenAI 类型为例）：

```typescript
applyPreset: (preset) => {
  const data = JSON.parse(preset.data);
  const conn = useConnectionStore.getState();
  const promptMgr = usePromptManagerStore.getState();

  if (preset.apiType === 'openai') {
    // 1. 解析 provider 和 model
    const { provider, model } = resolveProviderAndModel(data);
    conn.setProvider(provider as Provider);
    conn.setModel(model);

    // 2. 采样参数
    if (data.temperature !== undefined) conn.setTemperature(data.temperature);
    if (data.openai_max_tokens !== undefined) conn.setMaxTokens(data.openai_max_tokens);
    if (data.top_p !== undefined) conn.setTopP(data.top_p);
    if (data.top_k !== undefined) conn.setTopK(data.top_k);
    if (data.frequency_penalty !== undefined) conn.setFrequencyPenalty(data.frequency_penalty);
    if (data.presence_penalty !== undefined) conn.setPresencePenalty(data.presence_penalty);
    // ... 其他新增采样参数

    // 3. Prompt 排序 — 关键！
    if (data.prompts && data.prompt_order) {
      promptMgr.loadFromPreset(data.prompts, data.prompt_order);
    }

    // 4. 代理
    if (data.reverse_proxy !== undefined) conn.setReverseProxy(data.reverse_proxy);
  }
  // ... 其他类型的 apply 逻辑
},
```

### 7.8.2 扩展 `client/stores/connection-store.ts`

添加原版 OpenAI 预设中存在但当前缺少的采样参数：

```typescript
interface ConnectionState {
  // ... 现有字段 ...

  // 新增采样参数
  topA: number;                  // top_a, 默认 0
  minP: number;                  // min_p, 默认 0
  repetitionPenalty: number;     // repetition_penalty, 默认 1
  maxContext: number;            // openai_max_context, 默认 4096
  streamEnabled: boolean;        // stream_openai, 默认 true
  seed: number;                  // seed, 默认 -1 (random)

  // 提示词模板
  assistantPrefill: string;      // assistant_prefill
  continuePrefill: boolean;      // continue_prefill
  continuePostfix: string;       // continue_postfix
  namesBehavior: number;         // names_behavior (0=none, 1=completion, 2=content)
  squashSystemMessages: boolean; // squash_system_messages

  // 新增 setter
  setTopA: (v: number) => void;
  setMinP: (v: number) => void;
  setRepetitionPenalty: (v: number) => void;
  setMaxContext: (v: number) => void;
  setStreamEnabled: (v: boolean) => void;
  setSeed: (v: number) => void;
  setAssistantPrefill: (v: string) => void;
  setContinuePrefill: (v: boolean) => void;
  setContinuePostfix: (v: string) => void;
  setNamesBehavior: (v: number) => void;
  setSquashSystemMessages: (v: boolean) => void;
}
```

### 7.8.3 改造 `client/stores/prompt-manager-store.ts`

扩展 `PromptComponent` 接口以兼容原版格式：

```typescript
export interface PromptComponent {
  id: string;              // 对应原版 identifier
  name: string;
  enabled: boolean;
  position: number;
  role: "system" | "user" | "assistant";
  content?: string;
  isBuiltIn: boolean;
  isMarker: boolean;       // 新增：true = 结构性占位符，无可编辑内容
}
```

新增两个关键方法：

```typescript
/**
 * 从原版 OpenAI 预设的 prompts + prompt_order 加载排序
 * 这是实现预设 → 排序联动的核心方法
 */
loadFromPreset: (prompts: STPromptEntry[], promptOrder: STPromptOrderEntry[]) => void;

/**
 * 导出当前排序为原版格式
 * 用于保存预设时将当前排序写回 JSON blob
 */
exportToPresetFormat: () => { prompts: STPromptEntry[]; prompt_order: STPromptOrderEntry[] };
```

`loadFromPreset` 实现逻辑：

```typescript
loadFromPreset: (prompts, promptOrder) => set((state) => {
  // 找到全局排序（character_id: 100001）或默认排序（100000）
  const globalOrder = promptOrder.find(o => o.character_id === 100001)
    ?? promptOrder.find(o => o.character_id === 100000)
    ?? promptOrder[0];

  if (!globalOrder) return state;

  const components: PromptComponent[] = [];
  let position = 0;

  for (const orderItem of globalOrder.order) {
    const promptDef = prompts.find(p => p.identifier === orderItem.identifier);
    if (!promptDef) continue;

    components.push({
      id: promptDef.identifier,
      name: promptDef.name,
      enabled: orderItem.enabled,
      position: position++,
      role: (promptDef.role as "system" | "user" | "assistant") ?? "system",
      content: promptDef.content,
      isBuiltIn: !!promptDef.marker,
      isMarker: !!promptDef.marker,
    });
  }

  // 处理 prompts 中有定义但 order 中没有的条目（追加到末尾，默认禁用）
  for (const promptDef of prompts) {
    if (!components.find(c => c.id === promptDef.identifier)) {
      components.push({
        id: promptDef.identifier,
        name: promptDef.name,
        enabled: false,
        position: position++,
        role: (promptDef.role as "system" | "user" | "assistant") ?? "system",
        content: promptDef.content,
        isBuiltIn: !!promptDef.marker,
        isMarker: !!promptDef.marker,
      });
    }
  }

  return { components };
}),
```

### 7.8.4 扩展 `client/lib/api.ts`

在 `presetApi` 中新增：

```typescript
export const presetApi = {
  // ... 现有方法保持不变 ...

  /** 导入预设 */
  async import(name: string, apiType: string, data: Record<string, unknown>): Promise<Preset> {
    return mapPreset(
      await request<unknown>("/presets/import", {
        method: "POST",
        body: JSON.stringify({ name, apiType, data }),
      })
    );
  },

  /** 导出预设 */
  async export(id: number): Promise<{ name: string; apiType: string; data: Record<string, unknown> }> {
    return request(`/presets/${id}/export`);
  },

  /** 恢复默认预设 */
  async restore(id: number): Promise<{ isDefault: boolean; preset: Record<string, unknown> }> {
    return request(`/presets/${id}/restore`, { method: "POST" });
  },

  /** 获取某类型的默认预设列表 */
  async getDefaults(apiType: string): Promise<string[]> {
    return request(`/presets/defaults/${apiType}`);
  },
};
```

---

## 7.9 前端 UI 组件

### 7.9.1 新建 `client/components/settings/preset-selector.tsx`

通用的预设选择器组件，各个设置区域复用：

```typescript
interface PresetSelectorProps {
  apiType: string;               // 当前预设类型
  onPresetApplied?: () => void;  // 预设加载后的回调
}
```

UI 元素：
- **下拉选择框**：列出该 apiType 下的所有预设，内置预设带 `[Default]` 标记
- **保存按钮**：弹出输入框填写名称，保存当前设置为新预设
- **覆盖保存按钮**：更新当前已选预设（非默认预设时显示）
- **导入按钮**：打开文件选择器，接受 `.json` 文件
  - 读取文件 → `detectPresetType()` 自动识别类型 → 若类型与当前 apiType 不匹配则警告 → 调用 `presetApi.import()` → 刷新列表
- **导出按钮**：调用 `presetApi.export()` → 触发浏览器下载 `{name}.json`
- **删除按钮**：非默认预设可删除，默认预设此按钮灰显
- **恢复按钮**：仅默认预设显示，调用 `presetApi.restore()` → 恢复并重新加载

### 7.9.2 改造 `client/components/settings/settings-panel.tsx`

重构设置面板的标签页结构：

**Connection 标签页**：
- Provider / Model / API Key（不变）
- **Completion Preset 选择器**：`<PresetSelector apiType={completionApiType} />`
  - `completionApiType` 根据当前 provider 映射：
    - openai/anthropic/google/openrouter/mistral → `'openai'`
    - custom + Text Generation WebUI → `'textgen'`
    - custom + KoboldAI → `'kobold'`
  - 目前简化处理：全部使用 `'openai'` 类型即可，后续按需扩展
- Sampling 参数滑块（扩展后的参数）

**Prompts 标签页**：
- Prompt Manager（排序）— 已有，需连通后端
- **System Prompt 预设选择器**：`<PresetSelector apiType="sysprompt" />`
- **Context Template 预设选择器**：`<PresetSelector apiType="context" />`

**Instruct 标签页**（新增）：
- **Instruct 预设选择器**：`<PresetSelector apiType="instruct" />`
- Instruct 参数预览/编辑（input_sequence, output_sequence 等）

**Memory 标签页**：
- RAG 设置（不变）

### 7.9.3 导入流程详细设计

```
用户点击 Import → 打开文件选择器 (accept=".json")
  ↓
读取文件内容 → JSON.parse()
  ↓
detectPresetType(parsedData) → 自动识别类型
  ↓
if (识别的类型 !== 当前选择器的 apiType) {
  显示确认对话框："检测到这是一个 {type} 类型的预设，是否导入到 {type} 类型？"
}
  ↓
取文件名（去 .json 后缀）作为预设名
  ↓
presetApi.import(name, apiType, parsedData)
  ↓
刷新预设列表 → 自动选中刚导入的预设 → 应用
```

---

## 7.10 PromptBuilder 集成（阶段 4 — 最关键）

### 问题

当前 `PromptBuilderService.buildSystemMessages()` 的组装顺序是硬编码的：
```
system_prompt → persona → worldInfoBefore → description → personality → scenario →
worldInfoAfter → examples → post_history_instructions
```

需要改为**可配置的**，由前端传入的 `promptOrder` 控制。

### 7.10.1 扩展生成请求类型

文件: `server/src/modules/chat/chat-generation.controller.ts`

在 `GenerateRequest` 类型中新增：

```typescript
type GenerateRequest = Omit<CompletionRequest, 'messages' | 'stream'> & {
  // ... 现有字段 ...

  /** 提示词组装顺序（来自预设的 prompt_order） */
  promptOrder?: Array<{
    identifier: string;
    enabled: boolean;
  }>;

  /** 自定义提示词组件内容（来自预设的 prompts 数组中可编辑的条目） */
  customPrompts?: Array<{
    identifier: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  /** 提示词模板（来自预设） */
  promptTemplates?: {
    impersonationPrompt?: string;
    newChatPrompt?: string;
    newGroupChatPrompt?: string;
    newExampleChatPrompt?: string;
    continueNudgePrompt?: string;
    groupNudgePrompt?: string;
  };

  /** Instruct 模板（来自 instruct 预设） */
  instructTemplate?: {
    inputSequence: string;
    outputSequence: string;
    systemSequence: string;
    stopSequence: string;
    inputSuffix: string;
    outputSuffix: string;
    systemSuffix: string;
    wrap: boolean;
    namesBehavior: string;
  };

  /** Context 模板（来自 context 预设） */
  contextTemplate?: {
    storyString: string;
    exampleSeparator: string;
    chatStart: string;
  };

  /** 是否合并连续的系统消息 */
  mergeSystemMessages?: boolean;
};
```

### 7.10.2 改造 PromptBuilderService

文件: `server/src/modules/chat/prompt-builder.service.ts`

新增 identifier → 内容的解析映射：

```typescript
interface PromptBuildContext {
  character: CharacterRow;
  persona?: string;
  worldInfoBefore: string[];
  worldInfoAfter: string[];
  examples: string;
  ragContext?: string;
  customPrompts: Map<string, { role: string; content: string }>;
}

/**
 * 根据 identifier 解析对应的消息内容
 */
private resolveIdentifier(
  identifier: string,
  context: PromptBuildContext,
): { role: string; content: string } | null {
  switch (identifier) {
    case 'main':
      return {
        role: 'system',
        content: context.customPrompts.get('main')?.content
          ?? context.character.system_prompt
          ?? '',
      };
    case 'charDescription':
      return { role: 'system', content: context.character.description ?? '' };
    case 'charPersonality':
      return { role: 'system', content: context.character.personality ?? '' };
    case 'scenario':
      return { role: 'system', content: context.character.scenario ?? '' };
    case 'personaDescription':
      return { role: 'system', content: context.persona ?? '' };
    case 'worldInfoBefore':
      return { role: 'system', content: context.worldInfoBefore.join('\n') };
    case 'worldInfoAfter':
      return { role: 'system', content: context.worldInfoAfter.join('\n') };
    case 'dialogueExamples':
      return { role: 'system', content: context.examples };
    case 'chatHistory':
      return null; // marker — 聊天历史在此位置插入
    case 'nsfw':
    case 'jailbreak':
    case 'enhanceDefinitions':
    default:
      // 自定义/可编辑提示词
      const custom = context.customPrompts.get(identifier);
      if (custom) return { role: custom.role, content: custom.content };
      return null;
  }
}
```

修改 `buildSystemMessages()` 方法：

```typescript
private buildSystemMessages(
  settings: PromptBuildSettings,
  promptOrder?: Array<{ identifier: string; enabled: boolean }>,
  customPrompts?: Array<{ identifier: string; role: string; content: string }>,
): Array<{ role: string; content: string }> {

  // 如果没有自定义排序，回退到现有硬编码逻辑（向后兼容）
  if (!promptOrder) {
    return this.buildSystemMessagesLegacy(settings);
  }

  const context: PromptBuildContext = {
    character: settings.character,
    persona: settings.personaDescription,
    worldInfoBefore: settings.worldInfoEntries?.filter(e => e.position === 'before_char').map(e => e.content) ?? [],
    worldInfoAfter: settings.worldInfoEntries?.filter(e => e.position === 'after_char').map(e => e.content) ?? [],
    examples: settings.character.mes_example ?? '',
    ragContext: settings.ragContext,
    customPrompts: new Map(
      (customPrompts ?? []).map(p => [p.identifier, { role: p.role, content: p.content }])
    ),
  };

  const messages: Array<{ role: string; content: string }> = [];

  for (const item of promptOrder) {
    if (!item.enabled) continue;

    if (item.identifier === 'chatHistory') {
      // chatHistory 是分界点，由外层 buildPrompt() 处理
      continue;
    }

    const resolved = this.resolveIdentifier(item.identifier, context);
    if (resolved && resolved.content.trim()) {
      messages.push(resolved);
    }
  }

  return messages;
}
```

### 7.10.3 前端发送排序数据

在 `client/components/chat/chat-panel.tsx` 或发起生成请求的位置，生成请求时附带当前排序：

```typescript
const promptMgr = usePromptManagerStore.getState();

const generateRequest = {
  // ... 现有字段 ...
  promptOrder: promptMgr.components
    .sort((a, b) => a.position - b.position)
    .map(c => ({ identifier: c.id, enabled: c.enabled })),
  customPrompts: promptMgr.components
    .filter(c => !c.isMarker && c.content)
    .map(c => ({ identifier: c.id, role: c.role, content: c.content! })),
};
```

---

## 7.11 测试计划

### 后端测试

文件: `server/src/modules/preset/preset.service.spec.ts`

```typescript
describe('PresetService', () => {
  describe('seedDefaults', () => {
    it('should seed default presets on init');
    it('should not duplicate presets on re-init');
  });

  describe('importPreset', () => {
    it('should import an OpenAI preset JSON with full blob');
    it('should import a KoboldAI preset JSON');
    it('should import an instruct preset JSON');
    it('should upsert when importing duplicate name+type');
  });

  describe('exportPreset', () => {
    it('should return parsed JSON data');
    it('should return null for non-existent preset');
  });

  describe('restore', () => {
    it('should restore a modified default preset to original');
    it('should return isDefault=false for non-default presets');
  });

  describe('remove', () => {
    it('should reject deletion of default presets');
    it('should allow deletion of user presets');
  });
});
```

文件: `server/src/modules/chat/prompt-builder.service.spec.ts`

```typescript
describe('PromptBuilderService', () => {
  describe('buildPrompt with custom promptOrder', () => {
    it('should respect the provided prompt order');
    it('should skip disabled components');
    it('should handle custom prompt content');
    it('should fall back to legacy order when promptOrder is not provided');
    it('should handle missing identifiers gracefully');
  });
});
```

文件: `server/src/modules/preset/preset.service.spec.ts` (额外)

```typescript
describe('Provider Mapping', () => {
  it('should map "claude" to "anthropic"');
  it('should map "google" to "google"');
  it('should map unknown sources to "custom"');
  it('should extract correct model for each provider');
});
```

文件: `client/lib/preset-type-detector.test.ts`

```typescript
describe('detectPresetType', () => {
  it('should detect OpenAI presets by chat_completion_source');
  it('should detect instruct presets by input_sequence');
  it('should detect context presets by story_string');
  it('should detect sysprompt presets by content + post_history');
  it('should detect KoboldAI presets by temp + rep_pen');
  it('should detect TextGen presets by temperature_last');
  it('should return null for unrecognizable data');
});
```

### 端到端测试场景

1. **导入原版预设 → 加载 → 生成**：从原版酒馆导出一个 OpenAI 预设 JSON → 导入到重写版 → 选择加载 → 验证 Prompt 排序正确应用到生成流程
2. **Instruct 模板切换**：切换 instruct 预设 → 验证后端使用正确的序列格式
3. **默认预设恢复**：修改默认预设 → 恢复 → 验证恢复为原始值

---

## 7.12 实施顺序

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 7.12.1 | 数据库迁移（加列 + 索引） | 无 |
| 7.12.2 | 拷贝默认预设 JSON 文件到 `defaults/` | 无 |
| 7.12.3 | 实现 `default-presets.ts` + `provider-mapping.ts` | 7.12.2 |
| 7.12.4 | 扩展 `PresetService`（seed + import/export/restore） | 7.12.1, 7.12.3 |
| 7.12.5 | 扩展 `PresetController`（新端点） | 7.12.4 |
| 7.12.6 | 后端测试 | 7.12.5 |
| 7.12.7 | `preset-type-detector.ts` | 无 |
| 7.12.8 | 新建 `preset-store.ts` | 7.12.5 |
| 7.12.9 | 扩展 `connection-store.ts`（新增采样参数） | 无 |
| 7.12.10 | 改造 `prompt-manager-store.ts`（loadFromPreset / exportToPresetFormat） | 无 |
| 7.12.11 | 扩展 `api.ts`（presetApi 新方法） | 7.12.5 |
| 7.12.12 | 实现 `preset-selector.tsx` 组件 | 7.12.8, 7.12.11 |
| 7.12.13 | 重构 `settings-panel.tsx` | 7.12.12 |
| 7.12.14 | 改造 `PromptBuilderService`（order-aware） | 无 |
| 7.12.15 | 扩展 `ChatGenerationController`（接收 promptOrder） | 7.12.14 |
| 7.12.16 | 前端生成请求附带排序数据 | 7.12.10, 7.12.15 |
| 7.12.17 | 集成测试 | 全部 |

---

## 7.13 关键设计决策

### 为什么存完整 JSON blob 而不是拆字段？

1. **原生兼容**：原版预设 JSON 导入后原样存储，导出后原样还原，无损
2. **前向兼容**：原版新增字段时无需改数据库 schema
3. **简单**：不需要维护 100+ 个字段的 ORM 映射
4. **灵活**：不同预设类型的 schema 完全不同，统一存 blob 最合理

### 为什么 Prompt 排序要前后端联动而不是纯后端？

1. **实时预览**：用户调整排序后需要在 UI 上即时看到效果
2. **预设联动**：加载预设时需要立即更新前端的 Prompt Manager UI
3. **灵活性**：用户可以在不保存预设的情况下临时调整排序

### Instruct / Context 模板何时使用？

当前重写版的 AI Provider 适配器都是基于 Chat Completion API（OpenAI 兼容）的，不需要 instruct 模板包装。但当对接 Text Generation WebUI 等本地模型时，instruct 模板用于将 chat 格式转换为补全格式。Context 模板则定义了 story_string 的组装方式。

**短期策略**：先实现 instruct/context 预设的存储、导入、选择 UI，但后端暂不消费这些模板。当后续添加 TextGen 后端支持时再集成。

**长期目标**：`PromptBuilderService` 支持两种模式 — Chat Completion 模式（当前）和 Text Completion 模式（使用 instruct 模板包装）。
