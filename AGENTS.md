# Repository Guidelines

## Project Structure & Module Organization
This repository is a Bun workspace monorepo with two primary apps:
- `client/`: Next.js 16 frontend (`app/`, `components/`, `stores/`, `lib/`, `public/`)
- `server/`: NestJS 11 backend (`src/modules/*`, `src/db/*`, `src/main.ts`)

Planning and implementation notes live in `specs/`. Runtime SQLite files are created under `server/data/` and must stay untracked.

## Build, Test, and Development Commands
- `bun install`: install all workspace dependencies
- `bun dev`: run frontend and backend in watch mode
- `bun dev:client`: run only the client (`localhost:3000`)
- `bun dev:server`: run only the API (`localhost:3001`)
- `bun build`: build all packages
- `bun run --filter @arctravern/client lint`: run client lint checks

When iterating on one workspace, use filters (example: `bun run --filter @arctravern/server build`).

## Coding Style & Naming Conventions
TypeScript `strict` mode is enabled across client and server. Keep new code fully typed.
- Indent with 2 spaces
- Use kebab-case file names (example: `chat-panel.tsx`)
- Follow NestJS suffixes: `*.module.ts`, `*.service.ts`, `*.controller.ts`
- Export React components in PascalCase
- Name Zustand hooks `useXxxStore`

Match existing quote style: client uses double quotes, server uses single quotes.

## Testing Guidelines
There is no root `test` script yet. Validate changes with:
1. `bun run --filter @arctravern/client lint`
2. `bun build`
3. Manual smoke check of `GET /api/health`

Add backend tests in `server/src` as `*.spec.ts`. Add frontend tests near relevant code as `*.test.tsx`.

## Commit & Pull Request Guidelines
Use Conventional Commits with `type(scope): summary`, for example:
- `feat(client): add message markdown rendering`
- `fix(server): validate provider config payload`

PRs should include:
1. Clear summary and affected workspace(s)
2. Verification commands run
3. Linked issue or relevant `specs/` section
4. Screenshots (UI) or request/response examples (API) for behavior changes

## Security & Configuration Tips
Never commit `.env*`, API keys, or `server/data/*.db`. Keep secrets in local environment files only and use non-production credentials for testing.
