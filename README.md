# Arctravern

A modern rewrite of [SillyTavern](https://github.com/SillyTavern/SillyTavern) with a clean architecture.

## Tech Stack

- **Frontend**: Vite 8 + React 19 + TypeScript 6 + shadcn/ui + Tailwind CSS 4
- **Backend**: NestJS 11 + TypeScript 6
- **Database**: SQLite (sql.js)
- **AI Integration**: Vercel AI SDK v6
- **Tooling**: Vite+ (`vp`) + pnpm workspace monorepo

## Quick Start

```bash
pnpm install
pnpm dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:3001`.

## Validation

```bash
pnpm check
pnpm test
pnpm build
```

## Project Structure

```text
client/     # Vite frontend (@arctravern/client)
server/     # NestJS backend (@arctravern/server)
specs/      # Implementation specs
```

## License

MIT
