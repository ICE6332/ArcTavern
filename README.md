<h1 align="center">ArcTavern</h1>

<p align="center">
  SillyTavern v1.15.0 的现代化完全重构 — 从聊天前端到<b>扮演框架</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voidzero-dev/vite-plus/main/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voidzero-dev/vite-plus/main/logo.svg">
    <img alt="Vite+" src="https://raw.githubusercontent.com/voidzero-dev/vite-plus/main/logo.svg" height="20">
  </picture>
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS">
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/shadcn%2Fui-base--mira-000000?logo=shadcnui" alt="shadcn/ui">
  <img src="https://img.shields.io/badge/LanceDB-embedded-00C4B4" alt="LanceDB">
  <img src="https://img.shields.io/badge/OpenUI-rendering-FF6B35" alt="OpenUI">
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm" alt="pnpm">
</p>

---

## 关于 ArcTavern

ArcTavern 是 [SillyTavern](https://github.com/SillyTavern/SillyTavern) v1.15.0 的完全功能复刻与架构重构。原 Express.js + Vanilla JS 单体被重构为 pnpm workspace monorepo，配备 NestJS 11 后端与 Vite 8 前端。

> SillyTavern 是一个聊天前端。ArcTavern 是一个**扮演框架**。

---

## 四层架构

四个模块对应人的四种能力，全部由角色卡参数化驱动：

| 层 | 类比 | 工程模块 | 状态 |
|---|---|---|---|
| **主脑层** Brain | 思考 | LLM 推理引擎 + AI 适配器 | ✅ 完成 |
| **皮肤层** Skin | 表现 | OpenUI 结构化渲染 + ComfyUI | ⚡ 部分完成 |
| **记忆层** Memory | 记忆 | RAG 管线 + 世界书向量扫描 | ⚡ 部分完成 |
| **工具层** Hands | 行动 | Agent + Function Call | 🔲 计划中 |

---

## 功能特性

- **多 AI 提供商** — OpenAI、Anthropic、Google、Mistral、OpenRouter、自定义端点，统一接口
- **TavernCard V2 兼容** — 导入 PNG/JSON 角色卡，完整保留元数据
- **世界信息 / Lorebook** — 关键词匹配 + 向量语义扫描（LanceDB），支持递归激活与概率控制
- **预设系统** — 8 种预设类型，内置默认预设，与 Prompt Manager 联动
- **斜杠命令** — ~80% ST 兼容的命令解析器，支持变量系统与快速回复
- **OpenUI 渲染** — 8 种 block type 结构化消息，实时 React 渲染
- **RAG 记忆** — 聊天历史向量化，语义相似度检索注入上下文
- **SSE 流式输出** — Server-Sent Events 实时推送 AI 响应
- **i18n** — 中英文双语界面，支持插值参数

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理 | [pnpm 10](https://pnpm.io) + [Vite+](https://github.com/voidzero-dev/vite-plus) (`vp` CLI) |
| 前端 | [Vite 8](https://vitejs.dev) + [React 19](https://react.dev) + [TypeScript 6](https://www.typescriptlang.org) |
| UI | [shadcn/ui](https://ui.shadcn.com) (`base-mira`) + [Tailwind CSS 4](https://tailwindcss.com) + [Hugeicons](https://hugeicons.com) |
| 后端 | [NestJS 11](https://nestjs.com) + TypeScript 6 |
| AI 集成 | [Vercel AI SDK v6](https://sdk.vercel.ai) (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/mistral`) |
| 数据库 | [SQLite via sql.js](https://sql.js.org) (Pure WASM，无 native bindings) |
| 向量数据库 | [LanceDB](https://lancedb.com) (embedded，Rust core) |
| 状态管理 | [Zustand](https://zustand-demo.pmnd.rs) (persisted) |
| 流式传输 | SSE (Server-Sent Events) |
| 测试 | [Vitest](https://vitest.dev) (via Vite+ test) |
| Lint / 格式化 | [oxlint](https://oxc.rs/docs/guide/usage/linter.html) + oxfmt |

---

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+

### 安装与启动

```bash
# 克隆仓库
git clone https://github.com/ICE6332/ArcTavern.git
cd ArcTavern

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

- 前端：`http://localhost:5000`
- 后端：`http://localhost:5001`

---

## 开发命令

```bash
pnpm dev              # 同时启动前端（:5000）和后端（:5001）
pnpm dev:client       # 仅 Vite 前端
pnpm dev:server       # 仅 NestJS 后端
pnpm check            # 格式检查 + lint + 类型检查（全 workspace）
pnpm test             # 运行所有测试
pnpm build            # 构建全部
pnpm ready            # check + test + build（CI 完整验证）
```

### 运行单个测试

```bash
# 服务端（.spec.ts）
cd server && pnpm exec vp test run src/modules/world-info/__tests__/world-info-scanner.service.spec.ts

# 客户端（.test.ts）
cd client && pnpm exec vp test run stores/__tests__/character-store.test.ts

# 按 pattern 过滤
cd server && pnpm exec vp test run -t "scan"
```

---

## 项目结构

```
ArcTavern/
├── client/                   # @arctravern/client — Vite 8 + React SPA
│   ├── components/           # 按域组织：character/, chat/, group/, persona/,
│   │                         #           settings/, sidebar/, tags/, world-info/
│   ├── components/ui/        # shadcn/ui 原语（自动生成，勿手动修改）
│   ├── stores/               # Zustand stores（每域一个）
│   ├── lib/                  # api/, utils, i18n, openui/, slash-commands/
│   ├── hooks/                # 自定义 React hooks
│   └── locales/              # i18n 翻译（en, zh）
│
├── server/                   # @arctravern/server — NestJS 11
│   └── src/modules/          # 特性模块（每域一个目录）
│       ├── ai-provider/      # AI 提供商适配、本地嵌入模型
│       ├── chat/             # 聊天核心、Prompt 构建、SSE 流式
│       ├── character/        # TavernCard 解析、角色 CRUD
│       ├── world-info/       # Lorebook、关键词 + 向量扫描
│       ├── rag/              # LanceDB 向量存储、异步嵌入队列
│       ├── preset/           # 8 种预设类型管理
│       └── ...               # group/, persona/, tag/, settings/, secret/
│
└── specs/                    # 实施规格文档（四层架构设计）
```

---

## 兼容层

| 数据类型 | 状态 |
|----------|------|
| TavernCard V2 角色卡 (PNG/JSON) | ✅ 已实现 |
| 世界信息 / Lorebook (JSON) | ✅ 已实现 |
| 预设（8 种类型 JSON） | ✅ 已实现 |
| 斜杠命令脚本 | ✅ ~80% ST 兼容 |
| 聊天记录 (JSONL) | 🔲 计划中 |
| 正则脚本 | 🔲 计划中 |

---

## 相关链接

- [SillyTavern 原版](https://github.com/SillyTavern/SillyTavern)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [LanceDB](https://lancedb.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Vite+](https://github.com/voidzero-dev/vite-plus)

---

## License

[Apache License 2.0](./LICENSE)
