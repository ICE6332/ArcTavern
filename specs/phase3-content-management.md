# 阶段 3：内容管理（P1）

**状态**: 🔲 待实施  
**前置**: 阶段 2

## 目标

世界信息/Lorebook、群组聊天、标签系统、人格系统、提示词管理器。

---

## 3.1 世界信息 / Lorebook 系统

### 原版实现参考

- 后端: `SillyTavern/src/endpoints/worldinfo.js`
- 前端: `SillyTavern/public/scripts/world-info.js`

### 数据结构

```typescript
interface WorldInfoBook {
  id: number;
  name: string;
  entries: Record<number, WorldInfoEntry>;
  extensions?: Record<string, unknown>;
}

interface WorldInfoEntry {
  uid: number;
  key: string[];                    // 主激活关键词
  keysecondary: string[];           // 次要关键词
  comment: string;                  // 条目名称/备注
  content: string;                  // 条目内容（注入到 prompt）
  constant: boolean;                // 始终激活
  vectorized: boolean;              // 使用向量搜索
  selective: boolean;               // 使用选择性逻辑
  selectiveLogic: SelectiveLogic;   // AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3
  order: number;                    // 插入优先级
  position: WIPosition;            // 插入位置
  disable: boolean;                 // 禁用
  addMemo: boolean;                 // 添加备注到 prompt
  excludeRecursion: boolean;        // 排除递归
  delayUntilRecursion: boolean;     // 延迟到递归
  displayIndex: number;             // UI 显示顺序
  probability: number;              // 激活概率 0-100
  useProbability: boolean;
  depth: number;                    // 扫描深度（默认 4）
  group: string;                    // 分组名
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number;                // 自定义扫描深度
  caseSensitive: boolean;
  matchWholeWords: boolean;
  useGroupScoring: boolean;
  automationId: string;
  role: 0 | 1 | 2;                 // system=0, user=1, assistant=2
  sticky: number;                   // 粘性持续轮数
  cooldown: number;                 // 冷却轮数
  delay: number;                    // 延迟轮数
  triggers: string[];               // 生成类型触发器

  // 角色过滤
  characterFilterNames: string[];
  characterFilterTags: string[];
  characterFilterExclude: boolean;

  // 扫描匹配范围
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
}

enum WIPosition {
  BEFORE_CHAR = 0,
  AFTER_CHAR = 1,
  AN_TOP = 2,
  AN_BOTTOM = 3,
  AT_DEPTH = 4,
  EXAMPLE_TOP = 5,
  EXAMPLE_BOTTOM = 6,
  // 7+ = outlets
}

enum SelectiveLogic {
  AND_ANY = 0,
  NOT_ALL = 1,
  NOT_ANY = 2,
  AND_ALL = 3,
}
```

### 激活算法

```
1. 构建扫描缓冲区 = 最近 N 条聊天消息 + 人格描述 + 角色数据
2. 遍历所有条目:
   a. 跳过 disabled 条目
   b. 检查 constant → 直接激活
   c. 主关键词匹配（任一匹配即可）
   d. 如果 selective:
      - AND_ANY: 主关键词 OR 次要关键词
      - NOT_ALL: 主关键词 AND NOT 所有次要关键词
      - NOT_ANY: 主关键词 AND NOT 任一次要关键词
      - AND_ALL: 主关键词 AND 所有次要关键词
   e. 应用概率检查
   f. 应用时间效果 (sticky/cooldown/delay)
3. 按 order 排序激活的条目
4. 如果启用递归: 用已激活条目的 content 重新扫描
5. 按 position 插入到 prompt 的对应位置
6. 检查 token 预算，超出则按优先级裁剪
```

### 全局设置

```typescript
interface WorldInfoSettings {
  world_info_depth: number;              // 默认扫描深度 (默认 2)
  world_info_min_activations: number;    // 最小激活数
  world_info_budget: number;             // Token 预算百分比
  world_info_budget_cap: number;         // 预算上限
  world_info_recursive: boolean;         // 启用递归
  world_info_max_recursion_steps: number;
  world_info_case_sensitive: boolean;
  world_info_match_whole_words: boolean;
  world_info_use_group_scoring: boolean;
  world_info_character_strategy: 0 | 1 | 2; // 均匀=0, 角色优先=1, 全局优先=2
}
```

### 实现任务

**后端 `server/src/modules/world-info/`**:

1. `world-info.module.ts`, `world-info.controller.ts`, `world-info.service.ts`
2. 端点:
   - `GET /api/world-info` — 列出所有世界信息书
   - `GET /api/world-info/:id` — 获取单本书（含所有条目）
   - `POST /api/world-info` — 创建新书
   - `PUT /api/world-info/:id` — 更新书
   - `DELETE /api/world-info/:id` — 删除书
   - `POST /api/world-info/:id/entries` — 添加条目
   - `PUT /api/world-info/:id/entries/:entryId` — 更新条目
   - `DELETE /api/world-info/:id/entries/:entryId` — 删除条目
   - `POST /api/world-info/import` — 导入（JSON 文件）
   - `GET /api/world-info/:id/export` — 导出
3. `world-info-scanner.service.ts` — 激活算法实现

**前端**:

4. `stores/world-info-store.ts` — 世界信息状态管理
5. `components/world-info/world-info-editor.tsx` — 书编辑器
6. `components/world-info/entry-editor.tsx` — 条目编辑器（所有字段）
7. `components/world-info/entry-list.tsx` — 条目列表（搜索、过滤、排序）

---

## 3.2 群组聊天

### 原版实现参考

文件: `SillyTavern/src/endpoints/groups.js`

### 数据结构

```typescript
interface Group {
  id: string;
  name: string;
  members: string[];              // 角色 ID 数组
  avatar_url?: string;
  allow_self_responses: boolean;  // 允许同一角色连续回复
  activation_strategy: ActivationStrategy;
  generation_mode: GenerationMode;
  disabled_members: string[];     // 禁用的角色 ID
  fav: boolean;
  chat_id: string;                // 当前聊天 ID
  chats: string[];                // 所有聊天 ID
  auto_mode_delay: number;        // 自动模式延迟（秒）
  generation_mode_join_prefix: string;
  generation_mode_join_suffix: string;
}

enum ActivationStrategy {
  NATURAL = 0,   // 根据上下文/提及自然选择
  LIST = 1,      // 按成员列表顺序轮流
  MANUAL = 2,    // 手动选择
  POOLED = 3,    // 随机池选择
}

enum GenerationMode {
  SWAP = 0,            // 单角色轮换（正常）
  APPEND = 1,          // 合并所有启用角色
  APPEND_DISABLED = 2, // 合并所有角色（含禁用）
}
```

### 实现任务

**后端 `server/src/modules/group/`**:

1. `group.module.ts`, `group.controller.ts`, `group.service.ts`
2. 数据库表:
   ```sql
   CREATE TABLE groups (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     avatar_url TEXT,
     allow_self_responses INTEGER DEFAULT 0,
     activation_strategy INTEGER DEFAULT 0,
     generation_mode INTEGER DEFAULT 0,
     disabled_members TEXT DEFAULT '[]',
     fav INTEGER DEFAULT 0,
     chat_id TEXT,
     auto_mode_delay INTEGER DEFAULT 5,
     join_prefix TEXT DEFAULT '',
     join_suffix TEXT DEFAULT '',
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE group_members (
     group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
     character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
     sort_order INTEGER DEFAULT 0,
     PRIMARY KEY (group_id, character_id)
   );
   ```
3. 端点:
   - `GET /api/groups` — 列出所有群组
   - `POST /api/groups` — 创建群组
   - `PUT /api/groups/:id` — 更新群组
   - `DELETE /api/groups/:id` — 删除群组
   - `POST /api/groups/:id/members` — 添加成员
   - `DELETE /api/groups/:id/members/:characterId` — 移除成员
   - `POST /api/groups/:id/generate` — 群组聊天生成（需要轮次选择逻辑）

4. `group-turn-order.service.ts` — 轮次选择算法:
   - NATURAL: 分析最后消息和上下文，判断谁应该说话
   - LIST: 按成员列表顺序循环
   - MANUAL: 返回等待手动选择的状态
   - POOLED: 从启用成员中随机选择

**前端**:

5. `stores/group-store.ts`
6. `components/group/group-editor.tsx` — 群组编辑（成员管理、设置）
7. `components/group/group-chat.tsx` — 群组聊天界面（多角色头像、手动选择 UI）
8. `components/sidebar/sidebar.tsx` 扩展 — 群组列表

---

## 3.3 标签系统

### 数据结构

```typescript
interface Tag {
  id: string;                          // UUID
  name: string;
  folder_type: 'OPEN' | 'CLOSED' | 'NONE';
  sort_order: number;
  color?: string;                      // 背景色
  color2?: string;                     // 前景色
  create_date: number;
  is_hidden_on_character_card: boolean;
}

// 标签映射: 实体 → 标签 ID 数组
type TagMap = Record<string, string[]>;
```

### 实现任务

**后端**:

1. 数据库表:
   ```sql
   CREATE TABLE tags (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL UNIQUE,
     folder_type TEXT DEFAULT 'NONE',
     sort_order INTEGER DEFAULT 0,
     color TEXT,
     color2 TEXT,
     is_hidden INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE entity_tags (
     entity_type TEXT NOT NULL,  -- 'character' | 'group'
     entity_id TEXT NOT NULL,
     tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
     PRIMARY KEY (entity_type, entity_id, tag_id)
   );
   ```

2. 可合并到 `character.controller.ts` 或独立 `tag.controller.ts`:
   - `GET /api/tags` — 列出所有标签
   - `POST /api/tags` — 创建标签
   - `PUT /api/tags/:id` — 更新标签
   - `DELETE /api/tags/:id` — 删除标签
   - `POST /api/tags/:id/assign` — 分配标签到实体
   - `DELETE /api/tags/:id/unassign` — 取消分配

**前端**:

3. `components/tags/tag-badge.tsx` — 标签徽章（带颜色）
4. `components/tags/tag-filter.tsx` — 三态过滤器（未选/选中/排除）
5. `components/sidebar/sidebar.tsx` 扩展 — 标签过滤栏
6. 文件夹标签: OPEN 文件夹显示所有角色，CLOSED 文件夹隐藏角色除非选中

---

## 3.4 人格/用户角色系统

### 数据结构

```typescript
interface Persona {
  id: string;                          // 头像文件名
  name: string;
  description: string;
  position: PersonaPosition;
  depth: number;                       // 默认 2
  role: 0 | 1 | 2;                    // system=0, user=1, assistant=2
  lorebook?: string;                   // 关联的世界信息书
  title?: string;
  connections: PersonaConnection[];    // 关联的角色/群组
  is_default: boolean;
}

interface PersonaConnection {
  type: 'character' | 'group';
  id: string;
}

enum PersonaPosition {
  IN_PROMPT = 0,
  AFTER_CHAR = 1,    // 已弃用
  AT_DEPTH = 2,
}
```

### 实现任务

**后端**:

1. 数据库表:
   ```sql
   CREATE TABLE personas (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT DEFAULT '',
     position INTEGER DEFAULT 0,
     depth INTEGER DEFAULT 2,
     role INTEGER DEFAULT 0,
     lorebook TEXT,
     title TEXT,
     is_default INTEGER DEFAULT 0,
     avatar_path TEXT,
     created_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE persona_connections (
     persona_id TEXT REFERENCES personas(id) ON DELETE CASCADE,
     entity_type TEXT NOT NULL,
     entity_id TEXT NOT NULL,
     PRIMARY KEY (persona_id, entity_type, entity_id)
   );
   ```

2. `modules/persona/` — persona.module, controller, service
3. 端点:
   - `GET /api/personas` — 列出
   - `POST /api/personas` — 创建
   - `PUT /api/personas/:id` — 更新
   - `DELETE /api/personas/:id` — 删除
   - `POST /api/personas/:id/avatar` — 上传头像
   - `PUT /api/personas/:id/connections` — 更新关联

**前端**:

4. `stores/persona-store.ts`
5. `components/persona/persona-selector.tsx` — 人格选择器
6. `components/persona/persona-editor.tsx` — 人格编辑器
7. 自动选择: 根据当前角色/群组的 connections 自动切换人格

---

## 3.5 提示词管理器

### 说明

原版的 Prompt Manager 允许用户自定义 prompt 组装顺序、启用/禁用各个 prompt 组件、设置角色和深度。

### 实现任务

1. `components/settings/prompt-manager.tsx`:
   - 可拖拽排序的 prompt 组件列表
   - 每个组件: 启用/禁用开关、角色选择、深度设置
   - 组件类型: System Prompt, Character Description, Personality, Scenario, World Info (Before/After), Examples, Chat History, Author's Note, Jailbreak
   - 预览: 显示当前 prompt 组装结果和 token 计数

2. `stores/prompt-manager-store.ts` — prompt 顺序和配置持久化

---

## 验证标准

1. 创建世界信息书 → 添加条目 → 聊天中关键词触发 → 条目内容注入 prompt
2. 创建群组 → 添加多个角色 → 群组聊天中角色轮流回复
3. 创建标签 → 分配给角色 → 按标签过滤角色列表
4. 创建人格 → 关联角色 → 切换角色时自动切换人格
5. 提示词管理器 → 拖拽调整顺序 → prompt 组装结果正确
