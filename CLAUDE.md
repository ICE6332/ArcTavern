# CLAUDE.md — Next-Arctravern

## Project Overview

A full-feature rewrite of SillyTavern (v1.15.0) with a modern architecture. The original is an Express.js + vanilla JS monolith; this project restructures it into a clean monorepo with a NestJS backend and Next.js frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Package Manager | Bun (workspace monorepo) |
| Frontend | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui (base-mira style) + Tailwind CSS 4 + hugeicons |
| Backend | NestJS 11 + TypeScript |
| Database | SQLite via sql.js (pure WASM, no native bindings) |
| State Management | Zustand (persisted) |
| Streaming | SSE (Server-Sent Events) for AI completions |

## Monorepo Structure

```
Next-Arctravern/
├── package.json              # Bun workspace root
├── client/                   # Frontend (Next.js 16) — @arctravern/client
│   ├── app/                  # App Router pages
│   │   ├── layout.tsx        # Root layout (dark mode, Noto Sans + Geist fonts)
│   │   ├── globals.css       # CSS variables (light/dark, zinc base)
│   │   └── page.tsx          # Main 3-column layout
│   ├── components/
│   │   ├── ui/               # shadcn/ui primitives (button, card, input, select, etc.)
│   │   ├── chat/             # ChatPanel, MessageBubble, ChatInput
│   │   ├── character/        # CharacterCard
│   │   ├── sidebar/          # Sidebar (character list + chat list)
│   │   └── settings/         # SettingsPanel (provider, model, API key, sampling)
│   ├── stores/               # Zustand stores
│   │   ├── character-store.ts
│   │   ├── chat-store.ts     # Includes streaming support
│   │   └── connection-store.ts # Persisted provider/model/params config
│   ├── lib/
│   │   ├── utils.ts          # cn() utility
│   │   └── api.ts            # Typed API client with streaming
│   ├── components.json       # shadcn config (base-mira, hugeicons, zinc)
│   └── next.config.ts        # Rewrites /api/* → localhost:3001
│
├── server/                   # Backend (NestJS 11) — @arctravern/server
│   ├── src/
│   │   ├── main.ts           # Bootstrap: helmet, CORS, /api prefix, port 3001
│   │   ├── app.module.ts     # Root module
│   │   ├── health.controller.ts
│   │   ├── db/
│   │   │   ├── drizzle.module.ts
│   │   │   ├── drizzle.service.ts  # sql.js SQLite with auto-save (30s)
│   │   │   └── schema.ts          # Table definitions
│   │   ├── modules/
│   │   │   ├── character/    # Character CRUD
│   │   │   ├── chat/         # Chat + Message CRUD
│   │   │   ├── ai-provider/  # Multi-provider AI adapter (OpenAI, Anthropic, Google)
│   │   │   ├── secret/       # API key storage (AES-256-CBC encrypted)
│   │   │   ├── preset/       # Sampling parameter presets
│   │   │   └── settings/     # Key-value settings (JSON serialized)
│   │   └── types/
│   │       └── sql.js.d.ts   # Custom type declarations for sql.js
│   └── data/                 # Runtime data (SQLite DB, uploads)
│
└── specs/                    # Implementation specs (per-phase)
```

## Development Commands

```bash
# Install all dependencies
bun install

# Start both frontend and backend in dev mode
bun dev

# Start individually
bun dev:client    # Next.js on :3000
bun dev:server    # NestJS on :3001

# Build
bun build
```

## Architecture Decisions

- **sql.js over better-sqlite3**: Native bindings fail on Node.js v25 + bun 1.3.3. sql.js uses pure WASM — no gyp, no Python dependency.
- **Raw SQL over Drizzle query builder**: DrizzleService wraps sql.js with `query<T>()`, `run()`, `get<T>()` methods. Services use raw SQL strings.
- **SSE over WebSocket for streaming**: Simpler for unidirectional AI response streaming. The ai-provider controller uses `@Sse()` decorator.
- **Adapter pattern for AI providers**: Each provider (OpenAI, Anthropic, Google) implements `ProviderAdapter` interface with `buildRequest()`, `parseResponse()`, `parseStreamChunk()`.
- **Next.js rewrites for API proxy**: In dev, `/api/*` is rewritten to `http://localhost:3001/api/*` so the frontend doesn't need CORS handling.

## Key Patterns

- **Services export Row interfaces**: e.g. `CharacterRow`, `ChatRow`, `MessageRow`, `PresetRow` — used for type-safe SQL results.
- **Zustand stores call API client**: Stores in `stores/` use `lib/api.ts` which provides typed fetch wrappers and async generator streaming.
- **Connection store is persisted**: Uses `zustand/middleware` persist to localStorage for provider/model/sampling params.
- **shadcn/ui components**: Pre-installed in `components/ui/`. Use `npx shadcn@latest add <component>` to add more. Style is `base-mira` with `hugeicons` icon library.

## Database

SQLite file at `server/data/arctravern.db`. Tables:
- `characters` — name, avatar, description, personality, scenario, first_mes, etc.
- `chats` — character_id FK, title, metadata JSON
- `messages` — chat_id FK, role, content, timestamp
- `presets` — name, provider, params JSON
- `secrets` — key name, AES-256-CBC encrypted value
- `settings` — key-value pairs with JSON values
- `world_info_books`, `world_info_entries` — Lorebook system (schema defined, module pending)
- `groups_table` — Group chat (schema defined, module pending)

## Implementation Status

Phase 1 (Monorepo + Backend Skeleton) — **Complete**
- Bun workspace, NestJS with 6 modules, 44 API routes, SQLite persistence
- Next.js frontend with shadcn/ui, Zustand stores, API client, 3-column chat layout

Phase 2-6 — **Pending** (see `specs/` directory for detailed specs)

## Known Constraints

- Node.js v25 + Python 3.14 environment — avoid native C++ addons
- Bun 1.3.3 — some npm packages may have compatibility quirks
- sql.js requires `sql-wasm.wasm` file (bundled in node_modules/sql.js/dist/)

## Original SillyTavern Reference

The original codebase is at `G:\Sillytavern\SillyTavern\` for reference:
- `src/endpoints/` — 40+ Express route modules
- `public/script.js` — 492KB main frontend logic
- `public/scripts/` — Feature modules (openai.js, world-info.js, extensions.js, etc.)
- `src/character-card-parser.js` — TavernCard V2 PNG metadata parser
