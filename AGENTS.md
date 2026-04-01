# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ArcTavern is a pnpm workspace monorepo with two packages:

- `client/` — Vite 8 + React 19 SPA on port **5000**
- `server/` — NestJS 11 API on port **5001** (embedded SQLite + LanceDB, no external DB)

### Running dev servers

The root `pnpm dev` script uses PowerShell (`kill-dev-ports.ps1`) which does not work on Linux. Use these instead:

```bash
pnpm dev:server   # NestJS backend on :5001
pnpm dev:client   # Vite frontend on :5000 (proxies /api → :5001)
```

Start the server before the client. The client proxies `/api` to the backend.

### Commands reference

See `README.md` → "开发命令" for the full list. Key ones:

| Task | Command |
|------|---------|
| Lint + format + typecheck | `pnpm check` |
| All tests | `pnpm test` |
| Server tests only | `pnpm test:server` |
| Client tests only | `pnpm test:client` |
| Build | `pnpm build` |
| Full CI gate | `pnpm ready` |

### Notable caveats

- The `vp` CLI (vite-plus) is the underlying toolchain. `vp check` = oxfmt + oxlint + tsc. `vp test run` = vitest.
- There is 1 pre-existing flaky client test (`chat-store.test.ts` — RAF mock timing issue). Server tests (99/99) are stable.
- No external databases or Docker needed. SQLite (WASM via sql.js) and LanceDB are embedded and self-initializing.
- AI chat responses require provider API keys configured through the UI settings. The app starts and is fully testable without them.
- `pnpm.onlyBuiltDependencies` in root `package.json` allows post-install scripts for `@nestjs/core`, `msw`, `onnxruntime-node`, `protobufjs`, `sharp` (avoids interactive `pnpm approve-builds`).
- Seed a test character: `node scripts/seed-test-character.mjs http://localhost:5001/api`
