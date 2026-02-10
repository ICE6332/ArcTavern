# SillyTavern 重构 — 实施规格总览

本目录包含 SillyTavern v1.15.0 完全功能复刻 + 架构重构的分阶段实施规格。

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + shadcn/ui (base-mira) + Tailwind CSS 4
- **后端**: NestJS 11 + TypeScript + sql.js (SQLite WASM)
- **包管理**: Bun (monorepo workspace)
- **状态管理**: Zustand (persisted)

## 阶段

| 阶段 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 1 | [phase1-monorepo-backend-skeleton.md](./phase1-monorepo-backend-skeleton.md) | ✅ 已完成 | Monorepo 搭建、NestJS 后端骨架、SQLite、基础前端 |
| 2 | [phase2-core-chat-features.md](./phase2-core-chat-features.md) | 🔲 待实施 | TavernCard 解析、AI 适配器、聊天核心流程、角色管理 |
| 3 | [phase3-content-management.md](./phase3-content-management.md) | 🔲 待实施 | 世界信息、群组聊天、标签、人格、提示词管理器 |
| 4 | [phase4-advanced-features.md](./phase4-advanced-features.md) | 🔲 待实施 | 斜杠命令、变量、快速回复、正则引擎、扩展系统、备份 |
| 5 | [phase5-multimedia-integration.md](./phase5-multimedia-integration.md) | 🔲 待实施 | 图像生成、TTS/STT、翻译、图像描述、向量/RAG |
| 6 | [phase6-polish-deployment.md](./phase6-polish-deployment.md) | 🔲 待实施 | 多用户、i18n、数据迁移、性能优化、Docker |

## 使用说明

每个阶段的 spec 文件包含:
- 目标和前置依赖
- 原版 SillyTavern 的实现参考
- 完整的数据结构定义（TypeScript 接口）
- 后端 API 端点设计
- 数据库表结构
- 前端组件和 store 清单
- 验证标准

按阶段顺序实施，每个阶段完成后更新状态。

## 原版参考

原版 SillyTavern 代码位于 `G:\Sillytavern\SillyTavern\`，可随时查阅具体实现细节。
