# 阶段 4：高级功能（P2）

**状态**: 🔲 待实施  
**前置**: 阶段 3

## 目标

斜杠命令系统、变量系统、快速回复、正则表达式引擎、扩展/插件系统、备份管理。

---

## 4.1 斜杠命令系统

### 原版实现参考

文件: `SillyTavern/public/scripts/slash-commands/`

### 架构设计

```typescript
// 命令注册
interface SlashCommand {
  name: string;                          // 命令名（不含 /）
  callback: (namedArgs: NamedArgs, unnamedArgs: string) => string | Promise<string>;
  helpString: string;
  aliases: string[];
  returns?: string;                      // 返回值描述
  namedArgumentList: SlashCommandNamedArgument[];
  unnamedArgumentList: SlashCommandArgument[];
  source?: string;                       // 来源（核心/扩展名）
}

interface SlashCommandArgument {
  description: string;
  typeList: ArgumentType[];              // STRING, NUMBER, BOOLEAN, CLOSURE, LIST, DICTIONARY, VARIABLE_NAME
  isRequired: boolean;
  acceptsMultiple: boolean;
  defaultValue?: any;
  enumList?: EnumValue[];
  enumProvider?: () => EnumValue[];      // 动态枚举
  forceEnum: boolean;
}

interface SlashCommandNamedArgument extends SlashCommandArgument {
  name: string;
}

enum ArgumentType {
  STRING, NUMBER, BOOLEAN, CLOSURE, LIST, DICTIONARY, VARIABLE_NAME
}
```

### 命令解析器

```typescript
class SlashCommandParser {
  static commands: Record<string, SlashCommand>;

  static addCommand(command: SlashCommand): void;
  static removeCommand(name: string): void;

  // 解析文本为可执行闭包
  parse(text: string): SlashCommandClosure;
}

class SlashCommandClosure {
  scope: SlashCommandScope;
  execute(): Promise<SlashCommandClosureResult>;
}

interface SlashCommandClosureResult {
  pipe: string;          // 返回值（管道传递）
  isAborted: boolean;
  isBreak: boolean;
}
```

### 内置命令清单

**聊天管理:**
- `/delchat` — 删除当前聊天
- `/renamechat <name>` — 重命名聊天
- `/getchatname` — 获取当前聊天名
- `/closechat` — 关闭聊天
- `/tempchat` — 打开临时聊天

**角色/人格:**
- `/dupe` — 复制当前角色
- `/char-find name="..." tag="..."` — 查找角色
- `/sendas name="..." <text>` — 以角色身份发送
- `/sys <text>` / `/nar <text>` — 发送系统/旁白消息

**消息操作:**
- `/message-role [at=N] [role]` — 获取/设置消息角色
- `/message-name [at=N] [name]` — 获取/设置发送者名称

**生成控制:**
- `/gen` — 触发生成
- `/impersonate [prompt]` — 以用户身份生成
- `/continue` — 继续生成
- `/stop` — 停止生成

**API 管理:**
- `/api [name]` — 连接/获取当前 API

**UI 控制:**
- `/panels` — 切换面板
- `/bg [filename]` — 设置背景

**帮助:**
- `/?` / `/help [topic]` — 获取帮助

### 自动补全系统

```typescript
interface AutoComplete {
  textarea: HTMLElement;
  isActive: boolean;
  result: AutoCompleteOption[];
  selectedItem: AutoCompleteOption;
  matchType: 'fuzzy' | 'strict' | 'includes';
}

interface AutoCompleteOption {
  name: string;
  type: string;           // 'command' | 'variable' | 'enum' | 'quickReply' | 'macro'
  aliases: string[];
  makeItem(): HTMLElement;
  renderDetails(): HTMLElement;
}
```

### 实现任务

**前端 `lib/slash-commands/`**:

1. `slash-command-parser.ts` — 命令解析器（支持管道 `|`、闭包 `{:}`、嵌套）
2. `slash-command-registry.ts` — 命令注册表
3. `slash-command-scope.ts` — 变量作用域
4. `slash-command-closure.ts` — 可执行闭包
5. `built-in-commands.ts` — 所有内置命令实现
6. `components/chat/autocomplete.tsx` — 自动补全 UI（模糊匹配、键盘导航）

---

## 4.2 变量系统

### 原版实现参考

文件: `SillyTavern/public/scripts/variables.js`

### 变量作用域

```typescript
// 1. 局部变量（聊天级）
// 存储: chat_metadata.variables
// 生命周期: 当前聊天

// 2. 全局变量
// 存储: extension_settings.variables.global
// 生命周期: 永久

// 3. 作用域变量（执行级）
// 存储: SlashCommandScope 实例
// 生命周期: 命令执行期间
```

### 变量操作

```typescript
// 获取/设置（支持嵌套索引访问）
getLocalVariable(name: string, args?: { key?: string; index?: number | string }): string | number;
setLocalVariable(name: string, value: any, args?: { index?: number | string; as?: 'string' | 'number' | 'boolean' | 'list' | 'json' }): void;
getGlobalVariable(name: string, args?: { key?: string; index?: number | string }): string | number;
setGlobalVariable(name: string, value: any, args?: { index?: number | string; as?: string }): void;

// 算术
addLocalVariable(name: string, value: number | string): void;   // 数字加法或字符串/数组追加
incrementLocalVariable(name: string): void;                       // +1
decrementLocalVariable(name: string): void;                       // -1

// 删除
deleteLocalVariable(name: string): void;
deleteGlobalVariable(name: string): void;

// 存在检查
existsLocalVariable(name: string): boolean;
existsGlobalVariable(name: string): boolean;

// 解析优先级: 作用域 → 局部 → 全局 → 字面量
resolveVariable(name: string, scope?: SlashCommandScope): any;
```

### 变量宏

```
{{setvar::name::value}}     {{getvar::name}}
{{addvar::name::value}}     {{incvar::name}}     {{decvar::name}}
{{setglobalvar::name::value}}  {{getglobalvar::name}}
{{addglobalvar::name::value}}  {{incglobalvar::name}}  {{decglobalvar::name}}
```

### 斜杠命令

**变量管理:**
- `/let key=name [value]` — 声明作用域变量
- `/var key=name [value]` — 获取/设置作用域变量
- `/setvar key=name [value]` — 设置局部变量
- `/getvar key=name` — 获取局部变量
- `/setglobalvar`, `/getglobalvar`, `/addvar`, `/incvar`, `/decvar` 等
- `/flushvar key=name` — 删除局部变量
- `/listvar [scope=all|local|global]` — 列出变量

**控制流:**
- `/if left=a right=b rule=eq {...} else={...}` — 条件执行
  - rule: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `not`
- `/while left=a right=b rule=eq {...}` — 循环（默认上限 100 次）
- `/times count {...}` — 重复 N 次（`{{timesIndex}}` 可用）

**数学运算:**
- `/add`, `/sub`, `/mul`, `/div`, `/mod`, `/pow`
- `/sin`, `/cos`, `/log`, `/round`, `/abs`, `/sqrt`
- `/len` — 长度（字符串/数组/对象）
- `/rand from to [round=round|ceil|floor]` — 随机数

**数组/对象:**
- `/sort [keysort=true]` — 排序

### 实现任务

1. `lib/slash-commands/variables.ts` — 变量系统核心
2. `lib/slash-commands/variable-commands.ts` — 变量相关斜杠命令
3. `lib/slash-commands/control-flow-commands.ts` — 控制流命令
4. `lib/slash-commands/math-commands.ts` — 数学运算命令
5. `stores/variable-store.ts` — 变量状态管理（局部 + 全局持久化）

---

## 4.3 快速回复系统

### 数据结构

```typescript
interface QuickReply {
  id: number;
  icon?: string;                    // Font Awesome 图标类
  label: string;                    // 按钮标签
  showLabel: boolean;
  title?: string;                   // 工具提示
  message: string;                  // 要执行的斜杠命令脚本

  // 上下文菜单链接
  contextList: QuickReplyContextLink[];

  // 自动执行触发器
  preventAutoExecute: boolean;
  isHidden: boolean;
  executeOnStartup: boolean;
  executeOnUser: boolean;
  executeOnAi: boolean;
  executeOnChatChange: boolean;
  executeOnGroupMemberDraft: boolean;
  executeOnNewChat: boolean;
  executeBeforeGeneration: boolean;
  automationId?: string;
}

interface QuickReplySet {
  name: string;
  scope: 'global' | 'chat' | 'character';
  disableSend: boolean;
  placeBeforeInput: boolean;
  injectInput: boolean;
  color?: string;
  onlyBorderColor: boolean;
  qrList: QuickReply[];
}

interface QuickReplyContextLink {
  set: string;                      // 链接的 QR 集合名
  chain: boolean;                   // 链式执行
}
```

### 自动执行触发器

| 触发器 | 时机 |
|--------|------|
| `executeOnStartup` | 应用加载 |
| `executeOnUser` | 用户消息后 |
| `executeOnAi` | AI 回复后 |
| `executeOnChatChange` | 切换聊天 |
| `executeOnGroupMemberDraft` | 群组成员草稿 |
| `executeOnNewChat` | 新建聊天 |
| `executeBeforeGeneration` | AI 生成前 |

### 实现任务

**后端**: 快速回复数据存储在设置/聊天元数据中，无需独立后端模块。

**前端**:

1. `stores/quick-reply-store.ts` — QR 集合和状态管理
2. `components/quick-reply/quick-reply-bar.tsx` — 聊天输入框上方的 QR 按钮栏
3. `components/quick-reply/quick-reply-editor.tsx` — QR 编辑器（脚本编辑 + 触发器配置）
4. `components/quick-reply/quick-reply-set-manager.tsx` — QR 集合管理
5. `lib/slash-commands/quick-reply-commands.ts` — QR 相关斜杠命令

---

## 4.4 正则表达式引擎

### 原版实现参考

文件: `SillyTavern/public/scripts/extensions/regex/engine.js`

### 数据结构

```typescript
interface RegexScript {
  scriptName: string;
  findRegex: string;                // 正则表达式模式
  replaceString: string;            // 替换字符串（支持捕获组 $1, $2...）
  trimStrings: string[];            // 从匹配中修剪的字符串

  // 应用位置
  placement: RegexPlacement[];

  // 条件
  disabled: boolean;
  markdownOnly: boolean;            // 仅 Markdown 渲染时
  promptOnly: boolean;              // 仅 prompt 构建时
  runOnEdit: boolean;               // 编辑消息时运行
  minDepth: number;                 // 最小消息深度（-1 = 任意）
  maxDepth: number;                 // 最大消息深度（-1 = 任意）

  // 替换模式
  substituteRegex: SubstituteMode;
}

enum RegexPlacement {
  MD_DISPLAY = 0,       // Markdown 显示（已弃用）
  USER_INPUT = 1,       // 用户输入
  AI_OUTPUT = 2,        // AI 输出
  SLASH_COMMAND = 3,    // 斜杠命令
  WORLD_INFO = 5,       // 世界信息
  REASONING = 6,        // 推理输出
}

enum SubstituteMode {
  NONE = 0,             // 原样使用
  RAW = 1,              // 替换宏 {{char}} 等
  ESCAPED = 2,          // 替换并转义正则特殊字符
}

// 脚本类型（执行优先级）
enum ScriptType {
  GLOBAL = 0,           // 全局脚本（最高优先级）
  SCOPED = 1,           // 角色特定脚本
  PRESET = 2,           // 预设特定脚本（最低优先级）
}
```

### 执行流程

```
1. 检查正则扩展是否启用
2. 获取所有允许的脚本: GLOBAL → SCOPED → PRESET
3. 按 placement、markdownOnly/promptOnly、depth 过滤
4. 依次执行每个脚本:
   a. 根据 substituteRegex 模式替换 findRegex 中的宏
   b. 编译正则（LRU 缓存，最大 1000 条）
   c. 执行替换（支持捕获组）
   d. 应用 trimStrings
5. 返回最终转换后的字符串
```

### 权限系统

- 角色脚本需要用户明确允许（白名单）
- 预设脚本需要按 API + 预设名允许
- `isScopedScriptsAllowed(character)` / `isPresetScriptsAllowed(apiId, presetName)`

### 实现任务

1. `lib/regex-engine.ts` — 正则引擎核心（编译、缓存、执行）
2. `stores/regex-store.ts` — 正则脚本管理（全局/角色/预设）
3. `components/regex/regex-editor.tsx` — 脚本编辑器
4. `components/regex/regex-list.tsx` — 脚本列表（启用/禁用、排序、权限）
5. 集成到聊天流程: 用户输入前、AI 输出后、prompt 构建时调用

---

## 4.5 扩展/插件系统

### 原版实现参考

文件: `SillyTavern/public/scripts/extensions.js`

### 扩展清单 (manifest.json)

```typescript
interface ExtensionManifest {
  display_name: string;
  loading_order: number;            // 加载优先级（越小越先）
  requires?: string[];              // 需要的 Extras API 模块
  dependencies?: string[];          // 依赖的其他扩展
  minimum_client_version?: string;  // 最低客户端版本
  optional?: boolean;               // 加载失败是否报错
  js?: string;                      // 主 JS 文件路径
  css?: string;                     // CSS 文件路径
  author?: string;
  version?: string;
  homePage?: string;
  description?: string;
}
```

### 扩展生命周期

```
1. 发现: 扫描 extensions/ 目录
2. 排序: 按 loading_order 升序
3. 检查: minimum_client_version, requires, dependencies
4. 加载: 动态导入 JS + CSS
5. 初始化: 调用扩展 init 函数
6. 运行: 扩展通过事件系统和 API 交互
7. 卸载: 禁用时从 activeExtensions 移除
```

### 扩展 API

```typescript
// 扩展可用的 API
interface ExtensionAPI {
  // 事件系统
  eventSource: EventEmitter;        // 100+ 事件类型

  // 斜杠命令注册
  SlashCommandParser: typeof SlashCommandParser;

  // 设置读写
  extension_settings: Record<string, any>;
  saveSettingsDebounced(): void;

  // 角色数据读写
  writeExtensionField(characterId: string, fieldPath: string, value: any): void;
  readExtensionField(characterId: string, fieldPath: string): any;

  // 聊天元数据
  chat_metadata: Record<string, any>;
  saveMetadataDebounced(): void;

  // 模板渲染
  renderExtensionTemplateAsync(extName: string, templateId: string, data?: any): Promise<string>;
}
```

### 实现任务

**后端 `server/src/modules/extension/`**:

1. `extension.module.ts`, `extension.controller.ts`, `extension.service.ts`
2. 端点:
   - `GET /api/extensions` — 列出所有扩展
   - `GET /api/extensions/:name/manifest` — 获取清单
   - `POST /api/extensions/install` — 安装扩展（从 URL）
   - `DELETE /api/extensions/:name` — 卸载扩展
   - `PUT /api/extensions/:name/toggle` — 启用/禁用
3. 扩展文件存储: `server/data/extensions/`

**前端**:

4. `lib/extension-loader.ts` — 扩展加载器（动态导入、依赖解析）
5. `lib/extension-api.ts` — 扩展可用的 API 接口
6. `stores/extension-store.ts` — 扩展状态管理
7. `components/settings/extension-manager.tsx` — 扩展管理 UI（安装、启用/禁用、更新）

---

## 4.6 备份管理

### 原版实现参考

文件: `SillyTavern/src/endpoints/backups.js`

### 实现任务

**后端 `server/src/modules/backup/`**:

1. `backup.module.ts`, `backup.controller.ts`, `backup.service.ts`
2. 端点:
   - `GET /api/backups` — 列出所有备份
   - `POST /api/backups/create` — 创建备份（SQLite 数据库 + 文件系统快照）
   - `POST /api/backups/restore/:id` — 恢复备份
   - `DELETE /api/backups/:id` — 删除备份
   - `GET /api/backups/:id/download` — 下载备份文件
3. 自动备份: 可配置定时备份（cron）
4. 备份内容: SQLite 数据库文件 + 角色头像 + 用户头像

**前端**:

5. `components/settings/backup-manager.tsx` — 备份管理 UI

---

## 验证标准

1. 输入 `/help` → 显示命令列表
2. 输入 `/setvar key=test hello` → 变量设置成功 → `/getvar key=test` 返回 "hello"
3. `/if left=1 right=1 rule=eq {/echo true}` → 输出 "true"
4. 创建快速回复 → 点击按钮 → 执行脚本
5. 创建正则脚本（AI 输出替换）→ AI 回复被正确转换
6. 安装扩展 → 扩展功能可用 → 禁用后功能消失
7. 创建备份 → 删除数据 → 恢复备份 → 数据恢复
