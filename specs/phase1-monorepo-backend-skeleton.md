# 阶段 1：Monorepo 基础 + NestJS 后端骨架

**状态**: ✅ 已完成

## 目标

搭建 bun workspace monorepo，初始化 NestJS 后端，前后端能跑通。

## 已完成内容

### 1. Bun Workspace 根配置

- `package.json` — workspaces: `["client", "server"]`
- 脚本: `dev`, `dev:client`, `dev:server`, `build`, `build:client`, `build:server`

### 2. NestJS 后端 (`server/`)

- NestJS 11 + TypeScript strict
- 入口 `main.ts`: Helmet, CORS (localhost:3000), 全局前缀 `/api`, 端口 3001
- 6 个功能模块，共 44 条 API 路由:
  - `character/` — 角色 CRUD
  - `chat/` — 聊天 + 消息 CRUD
  - `ai-provider/` — 多 AI 提供商适配器 (OpenAI, Anthropic, Google) + SSE 流式
  - `secret/` — API 密钥管理 (AES-256-CBC 加密)
  - `preset/` — 采样参数预设
  - `settings/` — 键值对设置

### 3. SQLite 数据库 (sql.js)

- 使用 sql.js (纯 WASM) 替代 better-sqlite3 (原生绑定在 Node.js v25 + bun 1.3.3 下编译失败)
- `DrizzleService` 封装: `query<T>()`, `run()`, `get<T>()` 方法
- 自动保存 (30 秒间隔)，数据文件: `server/data/arctravern.db`
- 表: characters, chats, messages, presets, secrets, settings, world_info_books, world_info_entries, groups_table

### 4. Next.js 前端扩展

- `next.config.ts` — rewrites `/api/*` → `http://localhost:3001/api/*`
- `lib/api.ts` — 完整类型化 API 客户端，支持流式 async generator
- Zustand stores: `character-store.ts`, `chat-store.ts`, `connection-store.ts`
- 组件: Sidebar, ChatPanel, MessageBubble, ChatInput, CharacterCard, SettingsPanel
- 主页面: 三栏布局 (侧边栏 + 聊天区 + 设置面板)

### 5. 验证

- `bun install` ✅
- `bun dev` 同时启动前后端 ✅
- NestJS 在 :3001 启动，44 路由注册 ✅
- Next.js 在 :3000 启动 ✅
- `bun build:server` 编译通过 ✅

## 踩坑记录

| 问题 | 解决方案 |
|------|---------|
| better-sqlite3 原生绑定在 Node.js v25 + Python 3.14 + bun 1.3.3 下 gyp 编译失败 | 替换为 sql.js (纯 WASM SQLite) |
| `@types/better-sqlite3@^7.6.14` 在 bun 中找不到 | 降级到 `^7.6.12`，后来整个移除 |
| sql.js 缺少 TypeScript 类型声明 (TS7016) | 创建 `src/types/sql.js.d.ts` 自定义声明 |
| Service 中 Row 接口未导出导致 TS4053 | 给 CharacterRow, ChatRow, MessageRow, PresetRow 加 `export` |
| `as Promise<T>` 类型转换在同步返回值上报错 | 改用 `(await this.findOne(lastId))!` |
| client 目录下出现重复 bun.lock | 删除子目录的 bun.lock，只保留根目录的 |
