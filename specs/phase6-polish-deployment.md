# 阶段 6：完善与部署

**状态**: 🔲 待实施  
**前置**: 阶段 5

## 目标

多用户系统、国际化、数据迁移、性能优化、Docker 部署。

---

## 6.1 多用户系统

### 原版实现参考

文件: `SillyTavern/src/endpoints/users-admin.js`, `users-public.js`, `users-private.js`

### 用户模型

```typescript
interface User {
  id: string;
  handle: string;                   // 用户名
  name: string;                     // 显示名
  password?: string;                // bcrypt 哈希
  role: UserRole;
  enabled: boolean;
  created_at: string;
  last_login?: string;
  avatar?: string;
}

enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}
```

### 认证方式

| 方式 | 说明 |
|------|------|
| 密码认证 | 用户名 + 密码（bcrypt） |
| 免密模式 | 单用户模式，无需登录 |
| API Key | 用于 API 访问 |

### 实现任务

**后端 `server/src/modules/user/`**:

1. `user.module.ts`, `user.controller.ts`, `user.service.ts`
2. 数据库表:
   ```sql
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     handle TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     password_hash TEXT,
     role TEXT DEFAULT 'user',
     enabled INTEGER DEFAULT 1,
     avatar TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     last_login TEXT
   );
   ```
3. 端点:
   - `POST /api/users/login` — 登录
   - `POST /api/users/logout` — 登出
   - `GET /api/users/me` — 当前用户信息
   - `PUT /api/users/me` — 更新个人信息
   - `GET /api/users` — 列出用户（管理员）
   - `POST /api/users` — 创建用户（管理员）
   - `PUT /api/users/:id` — 更新用户（管理员）
   - `DELETE /api/users/:id` — 删除用户（管理员）
4. JWT 认证中间件
5. 角色守卫（RBAC）
6. 数据隔离: 每个用户独立的角色、聊天、设置

**前端**:

7. `app/login/page.tsx` — 登录页
8. `stores/auth-store.ts` — 认证状态
9. `components/settings/user-management.tsx` — 用户管理（管理员）

---

## 6.2 国际化 (i18n)

### 实现任务

1. 使用 `next-intl` 或 `react-i18next`
2. 语言文件: `client/locales/{lang}.json`
3. 初始支持: 英语 (en)、简体中文 (zh-CN)、日语 (ja)
4. 语言切换 UI
5. 日期/时间本地化

---

## 6.3 数据迁移工具

### 目标

从原版 SillyTavern 导入数据到新系统。

### 迁移内容

| 原版数据 | 迁移目标 |
|----------|---------|
| `characters/*.png` (TavernCard PNG) | `characters` 表 + 文件系统 |
| `chats/{character}/*.jsonl` | `chats` + `messages` 表 |
| `groups/*.json` | `groups` + `group_members` 表 |
| `worlds/*.json` | `world_info_books` + `world_info_entries` 表 |
| `OpenAI Settings/*.json` 等预设 | `presets` 表 |
| `settings.json` | `settings` 表 |
| `secrets.json` | `secrets` 表（重新加密） |
| `User Avatars/*` | `personas` 表 + 文件系统 |
| `groupChats/*.jsonl` | `chats` + `messages` 表（群组聊天） |

### 实现任务

**后端 `server/src/modules/migration/`**:

1. `migration.module.ts`, `migration.controller.ts`, `migration.service.ts`
2. 端点:
   - `POST /api/migration/scan` — 扫描原版数据目录，返回可迁移内容摘要
   - `POST /api/migration/import` — 执行迁移（支持选择性导入）
   - `GET /api/migration/status` — 迁移进度（SSE）
3. 迁移器:
   - `character-migrator.ts` — PNG 解析 → 入库
   - `chat-migrator.ts` — JSONL 解析 → 入库
   - `world-info-migrator.ts` — JSON 解析 → 入库
   - `settings-migrator.ts` — 设置转换
   - `group-migrator.ts` — 群组数据转换

**前端**:

4. `app/migration/page.tsx` — 迁移向导页面
5. 步骤: 选择原版目录 → 扫描 → 预览 → 确认 → 执行 → 完成

---

## 6.4 性能优化

### 实现任务

1. **前端**:
   - React.memo / useMemo 优化重渲染
   - 虚拟列表（角色列表、消息列表）— 使用 `@tanstack/react-virtual`
   - 图片懒加载
   - 代码分割（动态 import）
   - Service Worker 缓存静态资源

2. **后端**:
   - SQLite WAL 模式（并发读取）
   - 查询优化 + 索引
   - 响应压缩（gzip）
   - 角色列表浅加载（shallow mode）— 列表只返回必要字段
   - 聊天消息分页加载

3. **通用**:
   - Bundle 分析 + tree shaking
   - 图片压缩（头像自动压缩到合理尺寸）

---

## 6.5 Docker 部署

### 实现任务

1. `Dockerfile` — 多阶段构建:
   ```dockerfile
   # Stage 1: Build
   FROM oven/bun:1 AS builder
   WORKDIR /app
   COPY . .
   RUN bun install && bun run build

   # Stage 2: Runtime
   FROM oven/bun:1-slim
   WORKDIR /app
   COPY --from=builder /app/server/dist ./server/dist
   COPY --from=builder /app/client/.next ./client/.next
   COPY --from=builder /app/node_modules ./node_modules
   EXPOSE 3000 3001
   CMD ["bun", "run", "start"]
   ```

2. `docker-compose.yml`:
   ```yaml
   services:
     app:
       build: .
       ports:
         - "3000:3000"
         - "3001:3001"
       volumes:
         - ./data:/app/server/data
       environment:
         - NODE_ENV=production
   ```

3. `.dockerignore` — 排除 node_modules、.git 等

4. 生产环境配置:
   - Next.js standalone 输出模式
   - NestJS 生产构建
   - 环境变量管理

---

## 验证标准

1. 创建管理员 + 普通用户 → 各自数据隔离
2. 切换语言 → UI 文本正确翻译
3. 指定原版 SillyTavern 目录 → 迁移向导正确扫描 → 导入后数据完整
4. 1000+ 条消息的聊天 → 滚动流畅（虚拟列表）
5. `docker compose up` → 服务正常启动 → 浏览器可访问
