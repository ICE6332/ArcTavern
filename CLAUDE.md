# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next-Arctravern: a full-feature rewrite of SillyTavern (v1.15.0). The original Express.js + vanilla JS monolith is restructured into a Bun workspace monorepo with a NestJS 11 backend and Next.js 16 frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Package Manager | Bun (workspace monorepo) |
| Frontend | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui (base-mira style) + Tailwind CSS 4 + hugeicons |
| Backend | NestJS 11 + TypeScript |
| AI Integration | Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/mistral`, `@ai-sdk/openai-compatible`) |
| Database | SQLite via sql.js (pure WASM, no native bindings) |
| Vector DB | LanceDB (embedded, Rust core via native bindings) |
| State Management | Zustand (persisted) |
| Streaming | SSE (Server-Sent Events) for AI completions |
| Testing | Vitest (server) |

## Commands

```bash
bun install                  # Install all workspace dependencies
bun dev                      # Start both frontend (:3000) and backend (:3001)
bun dev:client               # Next.js only
bun dev:server               # NestJS only
bun build                    # Build all workspaces
bun test                     # Run all server tests (vitest)

# Workspace-scoped commands
bun run --filter @arctravern/client lint     # ESLint frontend
bun run --filter @arctravern/server build    # Build server only

# Run a single test file
cd server && bunx vitest run src/modules/chat/chat.service.spec.ts

# Run tests matching a pattern
cd server && bunx vitest run -t "pattern"

# Type check without emitting
cd server && bunx tsc --noEmit
cd client && bunx tsc --noEmit
```

## Architecture

### Monorepo Layout

- `client/` — Next.js 16 frontend (`@arctravern/client`). App Router, shadcn/ui components, Zustand stores.
- `server/` — NestJS 11 backend (`@arctravern/server`). Modular architecture under `src/modules/`.
- `specs/` — Phase-based implementation specs (phase1 through phase7).

### Backend Modules (server/src/modules/)

| Module | Purpose |
|--------|---------|
| `ai-provider` | Vercel AI SDK v6 integration — unified `generateText`/`streamText`/`embedMany` for 6 completion + 4 embedding providers |
| `character` | Character CRUD + TavernCard V2 PNG import/export (`character-card-parser.service.ts`) |
| `chat` | Chat/message CRUD + `prompt-builder.service.ts` for prompt assembly + `chat-generation.controller.ts` for SSE streaming |
| `group` | Group chat with multi-character turn management (`group-turn-order.service.ts`) |
| `persona` | User persona profiles with avatar support |
| `world-info` | Lorebook/World Info with keyword scanning (`world-info-scanner.service.ts`) |
| `rag` | RAG memory system — LanceDB vector store, async embedding queue, retrieval for prompt injection |
| `tag` | Tag system for organizing entities |
| `secret` | API key storage (AES-256-CBC encrypted) |
| `preset` | Sampling parameter presets |
| `settings` | Key-value settings (JSON serialized) |

### AI Provider — Vercel AI SDK v6

`AiProviderService` (in `ai-provider/ai-provider.service.ts`) uses the Vercel AI SDK instead of hand-written adapters. All provider-specific logic is handled by factory methods:

- `createLanguageModel(provider, model, apiKey, reverseProxy?)` — Returns an AI SDK `LanguageModel` via provider-specific factory (`createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`, `createMistral`, `createOpenAICompatible`)
- `createEmbeddingModel(provider, model, apiKey, reverseProxy?)` — Returns an AI SDK `EmbeddingModel` for vector generation

**Public methods:**
- `complete(req)` → `generateText()` — Non-streaming completion
- `streamComplete(req, signal?)` → `streamText().textStream` — Async generator yielding text deltas
- `embed(req)` → `embedMany()` — Batch text embedding

**Supported providers:** OpenAI, Anthropic, Google, OpenRouter (via `createOpenAI` with custom `baseURL`), Mistral, Custom (via `createOpenAICompatible`).

**API keys** come from `SecretService` (encrypted DB), not environment variables. Keys are passed to AI SDK factory functions at call time.

**Utility methods** (`healthCheck`, `testRequest`, `discoverModels`, `tokenize`, `getModels`) use raw `fetch()` for model discovery and health checks — these don't go through the AI SDK.

**AI SDK v6 API naming:** `maxOutputTokens` (not `maxTokens`), `ModelMessage` (not `CoreMessage`), `usage.inputTokens`/`usage.outputTokens` (not `promptTokens`/`completionTokens`).

### RAG Memory System (server/src/modules/rag/)

Provides long-term memory for AI characters via vector similarity search.

**Flow:**
1. After chat generation, new messages are queued for async embedding (non-blocking)
2. `RagEmbedderService` chunks text and calls `AiProviderService.embed()` to generate vectors
3. Vectors stored in LanceDB (`server/data/lancedb/`, tables named by dimension e.g. `memories_1536d`)
4. Before prompt building, `RagService.retrieveMemories()` embeds recent messages as query, searches for similar past content
5. Retrieved memories injected into prompt via `PromptBuilderService` at configurable position

**Key design:** RAG is non-blocking and fault-tolerant. Embedding failures are logged and skipped. Retrieval failures return empty array — generation proceeds normally.

**Settings** stored via `SettingsService` (key: `rag_settings`). Configurable: enabled, embedding provider/model, scope (chat vs character), max results, similarity threshold, token budget, chunk size/overlap, insertion position (before_char, after_char, at_depth).

### Database (sql.js)

`DrizzleService` wraps sql.js with three methods — services use raw SQL strings:
- `query<T>(sql, params?)` — SELECT, returns array
- `run(sql, params?)` — INSERT/UPDATE/DELETE, returns `{ changes, lastId }`
- `get<T>(sql, params?)` — Single row or null

SQLite file: `server/data/arctravern.db`. Auto-saves every 30 seconds.

### Chat Generation Flow

`ChatGenerationController.generate()` orchestrates the full pipeline:
1. Validate chat, character, provider/model
2. Add user message (if `type === 'normal'`)
3. Retrieve RAG memories (if enabled)
4. Build prompt via `PromptBuilderService` (system prompt → persona → world info → character desc → RAG context → example messages → chat history)
5. Stream completion via SSE
6. Persist assistant message with swipes
7. Fire-and-forget: embed new messages for RAG

Generation types: `normal`, `regenerate`, `swipe`, `continue`, `impersonate`, `quiet`.

### Frontend Stores (client/stores/)

Zustand stores call the typed API client (`lib/api.ts`). `connection-store` is persisted to localStorage.

Stores: `character-store`, `chat-store`, `connection-store`, `tag-store`, `persona-store`, `world-info-store`, `group-store`, `prompt-manager-store`, `language-store`, `rag-store`.

### API Client (client/lib/api.ts)

Typed fetch wrappers organized by domain: `characterApi`, `chatApi`, `aiApi`, `secretApi`, `presetApi`, `settingsApi`, `tagApi`, `personaApi`, `worldInfoApi`, `groupApi`, `ragApi`. Includes async generator streaming for SSE.

Next.js rewrites `/api/*` to `http://localhost:3001/api/*` in dev (configured in `next.config.ts`).

## Coding Conventions

- TypeScript `strict` mode in both workspaces
- 2-space indentation, kebab-case filenames
- Client: double quotes. Server: single quotes.
- NestJS files: `*.module.ts`, `*.service.ts`, `*.controller.ts`
- React components: PascalCase exports. Zustand hooks: `useXxxStore`.
- Services export Row interfaces (e.g. `CharacterRow`, `ChatRow`) for type-safe SQL results.
- Commit style: Conventional Commits — `type(scope): summary`

## Testing

Backend tests use Vitest. Specs are colocated as `*.spec.ts` next to the source files. Frontend tests (when added) go as `*.test.tsx` near components.

Vitest config: `server/vitest.config.ts` — node environment, globals enabled, clearMocks.

Test pattern: mock dependencies with `vi.fn()`, instantiate services directly (no DI container needed for unit tests).

## Known Constraints

- Node.js v25 + Python 3.14 environment — avoid native C++ addons (this is why sql.js over better-sqlite3)
- Bun 1.3.3 — some npm packages may have compatibility quirks
- sql.js requires `sql-wasm.wasm` (bundled in `node_modules/sql.js/dist/`)
- LanceDB uses Rust native bindings (acceptable in this project)
- Do not commit `server/data/*.db`, `server/data/lancedb/`, or `.env*` files

## Original SillyTavern Reference

The original codebase at `G:\Sillytavern\SillyTavern\` can be used for reference:
- `src/endpoints/` — 40+ Express route modules
- `public/script.js` — 492KB main frontend logic
- `public/scripts/` — Feature modules (openai.js, world-info.js, extensions.js, etc.)
- `src/character-card-parser.js` — TavernCard V2 PNG metadata parser
