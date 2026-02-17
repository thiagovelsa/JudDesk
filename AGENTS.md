# Repository Guidelines

## Project Overview
JurisDesk is a desktop app for a Brazilian law office: local SQLite data, client/case/document management, deadline reminders, and an AI assistant that can use extracted PDF text as context.

## Project Structure & Module Organization
- `docs/architecture/proposta-sistema-juridico.md`: architecture reference (stack, SQLite schema, main flows, dependencies, next steps).
- `docs/ux/relatorio-interface.md`: interface/UX analysis and improvement checklist.
- `docs/roadmap/versao2.md`: roadmap for the next major version.
- `README.md`: developer docs (commands, features, stack).
- `CLAUDE.md`: coding/architecture guidance for agent-assisted development.

The app is already scaffolded with a Tauri + React split:
- `src/`: React + TypeScript (feature components, pages, `stores/`, `lib/` utilities).
- `src-tauri/`: Rust/Tauri backend (`src/main.rs`, `Cargo.toml`, `tauri.conf.json`).

## Build, Test, and Development Commands
- Install deps: `npm install`
- Run locally: `npm run tauri dev`
- Production build: `npm run tauri build`
- Typecheck: `npx tsc -p tsconfig.json --noEmit`
- Tests (requires Node.js 20+): `npm test` or `npm run test:run`

## Coding Style & Naming Conventions
- React/TS: `PascalCase` components/files (e.g., `ClientForm.tsx`), `camelCase` functions/vars, keep feature folders cohesive (e.g., `components/clients/*`).
- UI: prefer Tailwind utilities; use tokens in `src/index.css` (e.g. `var(--space-*)`, `var(--table-cell-*)`) and the density toggle (`html[data-density='compact']`).
- Rust: follow `rustfmt` defaults; keep Tauri-specific logic in `src-tauri/`.

## Testing Guidelines
Vitest is configured. Keep tests deterministic, avoid network calls, and use `*.test.ts(x)` naming under `src/`.

## Commit & Pull Request Guidelines
This repo currently has no Git history. If/when initialized, use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) and keep PRs small with:
- a clear description and links to relevant sections in `docs/architecture/proposta-sistema-juridico.md`
- screenshots for UI changes when applicable
