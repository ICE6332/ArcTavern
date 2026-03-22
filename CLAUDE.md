# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arctravern: a full-feature rewrite of SillyTavern (v1.15.0). The original Express.js + vanilla JS monolith is restructured into a pnpm workspace monorepo with a NestJS 11 backend and a Vite 8 frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Package Manager | pnpm 10 + Vite+ (`vite-plus` CLI as `vp`) |
| Frontend | Vite 8 (via `@voidzero-dev/vite-plus-core`) + React 19 + TypeScript |
| UI | shadcn/ui (`base-mira` style) + Tailwind CSS 4 + hugeicons |
| Backend | NestJS 11 + TypeScript |
| AI Integration | Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/mistral`, `@ai-sdk/openai-compatible`) |
| Database | SQLite via sql.js (pure WASM, no native bindings) |
| Vector DB | LanceDB (embedded, Rust core via native bindings) |
| State Management | Zustand (persisted) |
| Streaming | SSE (Server-Sent Events) for AI completions |
| Testing | Vitest (both workspaces, via `@voidzero-dev/vite-plus-test`) |

### Vite+ / vite-plus

`pnpm-workspace.yaml` overrides `vite` and `vitest` with Vite+ equivalents:
```yaml
overrides:
  vite: npm:@voidzero-dev/vite-plus-core@0.1.11
  vitest: npm:@voidzero-dev/vite-plus-test@0.1.11
```
The `vp` CLI (from `vite-plus` devDependency) is used for workspace-wide `check`, `build`, and `test` commands. Client scripts use `vp dev`, `vp build`, `vp check`, `vp test run`. Client config imports `defineConfig` from `"vite-plus"`, not `"vite"`.

## Commands

```bash
pnpm install                 # Install all workspace dependencies
pnpm dev                     # Start both frontend (:3000) and backend (:3001)
pnpm dev:client              # Vite frontend only
pnpm dev:server              # NestJS only (nest start --watch)
pnpm check                   # vp run check -r (both workspaces)
pnpm build                   # vp run build -r (both workspaces)
pnpm test                    # vp run test -r (both workspaces)
pnpm ready                   # check + test + build (full CI-like validation)

# Workspace-scoped commands
pnpm --filter @arctravern/client check       # Vite+ check frontend
pnpm --filter @arctravern/client build       # Vite+ build frontend
pnpm --filter @arctravern/client lint        # ESLint (flat config, v9)
pnpm --filter @arctravern/server build       # nest build
pnpm --filter @arctravern/server check       # tsc --noEmit

# Run a single test file (server uses .spec.ts suffix)
cd server && pnpm exec vitest run src/modules/chat/chat.service.spec.ts

# Run a single test file (client uses .test.ts suffix)
cd client && pnpm exec vitest run stores/character-store.test.ts

# Run tests matching a pattern
cd server && pnpm exec vitest run -t "pattern"

# Type check without emitting
cd server && pnpm exec tsc --noEmit
cd client && pnpm exec tsc --noEmit
```

## Architecture

### Monorepo Layout

```
client/           @arctravern/client — Vite 8 + React SPA
  components/     Domain-organized: character/, chat/, group/, persona/,
                  settings/, sidebar/, tags/, world-info/, ai-elements/
  components/ui/  shadcn/ui primitives (auto-generated, do not hand-edit)
  stores/         Zustand stores (one per domain)
  lib/            api.ts (typed fetch client), utils, i18n, openui/
  hooks/          Custom React hooks
  locales/        i18n translations (en, zh)
  src/            App shell, main.tsx, globals.css, test setup

server/           @arctravern/server — NestJS 11
  src/modules/    Feature modules (one dir per domain)
  src/db/         DrizzleService (sql.js wrapper, NOT Drizzle ORM)
  src/types/      Type declarations for untyped packages
  data/           Runtime data (gitignored): arctravern.db, lancedb/

specs/            Phase-based implementation specs (phase1 through phase7)
```

### Path Aliases

Both workspaces use `@/` as a path alias:
- **Client:** `@/` → `client/` root (e.g., `@/components/...`, `@/stores/...`, `@/lib/...`)
- **Server:** `@/` → `server/src/` (e.g., `@/modules/...`, `@/db/...`)

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

**Custom provider API format (`customApiFormat`):** When `provider === 'custom'`, the frontend sends `customApiFormat` (`"openai-compatible" | "google" | "openai" | "anthropic"`) to select the native SDK. Google format auto-appends `/v1beta` to the base URL and requires all system messages hoisted to the front (`hoistSystemMessages()` in the controller). Stored in `connection-store` in the frontend.

**Structured output (`streamStructured`):** Path B — `streamText()` yields raw text that is accumulated and incrementally parsed by `tryParsePartialJson()` in `json-stream-parser.ts`. The parser strips markdown code fences (` ```json...``` `), then attempts direct `JSON.parse`, then bracket/brace repair. Schemas are defined in `structured-output-schema.ts` using Zod. The system prompt instructing the model to emit JSON is injected by `getStructuredOutputSystemPrompt()`. SSE chunks carry `{ structured: partialParsed }`. A cache-busting seed is injected per swipe/regenerate to prevent proxy caching identical responses.

**Block types** (defined in `client/lib/openui/structured-types.ts` and `structured-output-schema.ts`):
`narration`, `card` (markdown), `alert` (info/warning/error/success), `code` (language + content), `choices` (option buttons), `separator`, `task` (checklist), `progress` (value 0–100).

**API keys** come from `SecretService` (encrypted DB), not environment variables. Keys are passed to AI SDK factory functions at call time.

**Utility methods** (`healthCheck`, `testRequest`, `discoverModels`, `tokenize`, `getModels`) use raw `fetch()` for model discovery and health checks — these don't go through the AI SDK.

**AI SDK v6 API naming:** `maxOutputTokens` (not `maxTokens`), `ModelMessage` (not `CoreMessage`), `usage.inputTokens`/`usage.outputTokens` (not `promptTokens`/`completionTokens`).

### Database (sql.js)

`DrizzleService` (name is historical — this is NOT Drizzle ORM) wraps sql.js with three methods. Services use raw SQL strings:
- `query<T>(sql, params?)` — SELECT, returns array
- `run(sql, params?)` — INSERT/UPDATE/DELETE, returns `{ changes, lastId }`
- `get<T>(sql, params?)` — Single row or null

Schema is defined as raw SQL in `drizzle.service.ts` (not a separate schema file). SQLite file: `server/data/arctravern.db`. Auto-saves every 30 seconds.

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

**Swipe vs Regenerate:** Both call `generateSwipe()` on the frontend, which sends `type: "swipe"`. A swipe appends a new version to the existing message (user can flip between versions). The UI shows inline streaming on the last assistant message bubble during swipe generation (`isSwipeGenerating` flag). Persisted messages with `extra.format === "structured"` have their `content` field (raw JSON string) re-parsed back to `PartialStructuredResponse` in `chat-panel.tsx` for rendering — the content field is set to `""` to avoid showing raw JSON.

### RAG Memory System (server/src/modules/rag/)

Provides long-term memory for AI characters via vector similarity search.

**Flow:**
1. After chat generation, new messages are queued for async embedding (non-blocking)
2. `RagEmbedderService` chunks text and calls `AiProviderService.embed()` to generate vectors
3. Vectors stored in LanceDB (`server/data/lancedb/`, tables named by dimension e.g. `memories_1536d`)
4. Before prompt building, `RagService.retrieveMemories()` embeds recent messages as query, searches for similar past content
5. Retrieved memories injected into prompt via `PromptBuilderService` at configurable position

**Key design:** RAG is non-blocking and fault-tolerant. Embedding failures are logged and skipped. Retrieval failures return empty array — generation proceeds normally.

### Frontend API Client (client/lib/api.ts)

Typed fetch wrappers organized by domain: `characterApi`, `chatApi`, `aiApi`, `secretApi`, `presetApi`, `settingsApi`, `tagApi`, `personaApi`, `worldInfoApi`, `groupApi`, `ragApi`. Includes async generator streaming for SSE.

Base URL: defaults to `/api` (proxied to `localhost:3001` in dev via Vite proxy). Override with `VITE_API_BASE` env var for production/custom deployments.

### Frontend Stores (client/stores/)

Zustand stores call the typed API client. `connection-store` is persisted to localStorage.

### shadcn/ui Configuration

`client/components.json` configures shadcn with:
- Style: `base-mira`, Icon library: `hugeicons`, Base color: `zinc`
- Additional registries: `@abui` (abui.io), `@ai-elements` (ai-sdk.dev)
- Components live in `client/components/ui/` — these are auto-generated, prefer not hand-editing

## Coding Conventions

- TypeScript `strict` mode in both workspaces
- 2-space indentation, kebab-case filenames
- **Client:** double quotes, ESLint flat config (v9), `.test.ts` / `.test.tsx` test suffix
- **Server:** single quotes, no ESLint (relies on `tsc --noEmit`), `.spec.ts` test suffix
- NestJS files: `*.module.ts`, `*.service.ts`, `*.controller.ts`
- React components: PascalCase exports. Zustand hooks: `useXxxStore`.
- Services export Row interfaces (e.g. `CharacterRow`, `ChatRow`) for type-safe SQL results.
- Commit style: Conventional Commits — `type(scope): summary`

## Testing

Backend tests use Vitest with node environment. Frontend tests use Vitest with jsdom. Tests are colocated near source files.

- **Server:** `src/**/*.spec.ts` — mock dependencies with `vi.fn()`, instantiate services directly (no DI container)
- **Client:** `src/**/*.test.ts(x)`, `lib/**/*.test.ts`, `stores/**/*.test.ts` — setup file at `src/test/setup.ts`

### OpenUI / Structured Message Rendering

`StructuredMessage` component (`client/components/chat/structured-message.tsx`) renders JSON blocks. Each block `role` maps to a React component. To add a new block type: (1) add Zod schema entry to `structured-output-schema.ts`, (2) add TypeScript type to `structured-types.ts`, (3) add renderer branch in `StructuredMessage`. The AI only needs to know the `role` name — animations and visual complexity live entirely in the React component.

### `nest start --watch` Gotcha

Watch mode uses **ts-node** (not the compiled `dist/`). TypeScript compilation errors reported in watch logs (`Found N errors`) prevent new code from being loaded — the process continues running the last successful compilation. Always check the watch log for TS errors when server behavior seems stale. To force a clean restart: kill the process and re-run `pnpm dev`. Running `nest build` does not affect the watch server.

`AiProviderService` is not decorated with NestJS `@Logger()` — do not use `this.logger` in that class. Use `console.log` or inject `Logger` manually via constructor.

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
