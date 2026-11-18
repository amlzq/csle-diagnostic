# AGENTS.md

Guidance for AI coding agents and contributors working in this repository.

## Layout

VS Code extension written in TypeScript. Sources live in `src/` and compile to `out/`:

- `src/extension.ts` — activation and command registration
- `src/diagnostics/` — diagnostic collection and severity handling
- `src/scan/` — document/workspace scanning and applying findings
- `src/quickfix/` — quick fix (code action) provider
- `src/commands/` — diagnose all, accept all, auto diagnostic on open
- `src/utils/` — config, OpenCC wrapper, string extraction, custom dictionary store
- `src/view/` — results tree view and the custom dictionary webview panel
- `src/test/` — integration tests (VS Code test CLI); `src/test/unit/` — Mocha unit tests
- `l10n/` and `package.nls.*.json` — localized UI strings (zh-cn, zh-hk, zh-mo, zh-tw)

## Commands

Run from the repository root:

```bash
npm install
npm run compile     # tsc -p ./
npm run watch       # incremental compile
npm run lint        # eslint src
npm run test:unit   # Mocha unit tests (compiles first)
npm test            # VS Code integration tests (compiles and lints first)
```

## Commits and PR titles

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Scopes: `scan`, `diagnostics`, `quickfix`, `dictionary`, `panel`, `l10n` (omit when a change spans areas)
- Breaking changes: add `!` after the type/scope, e.g. `refactor(panel)!: drop the dictionary file path`

## Rules

- Add an entry to `CHANGELOG.md` under `Unreleased` for user-visible changes.
- Add or update tests for behavior changes: pure logic in `src/test/unit/`, editor behavior in `src/test/`.
- Add user-facing strings through `vscode.l10n.t(...)` or `package.nls.json`, and keep all locale files in sync.
- Do not hand-edit `out/`, `*.vsix`, or bump the version unless asked.
