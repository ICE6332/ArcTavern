# Next-Arctravern

A modern rewrite of [SillyTavern](https://github.com/SillyTavern/SillyTavern) with a clean architecture.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + shadcn/ui + Tailwind CSS 4
- **Backend**: NestJS 11 + TypeScript
- **Database**: SQLite (sql.js)
- **Package Manager**: Bun (monorepo)

## Quick Start

```bash
bun install
bun dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:3001`.

## Project Structure

```
├── client/     # Next.js frontend (@arctravern/client)
├── server/     # NestJS backend (@arctravern/server)
└── specs/      # Implementation specs
```

## License

MIT
