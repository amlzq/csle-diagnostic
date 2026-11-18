# Contributing

Thanks for your interest in contributing to csle-diagnostic!

## Getting started

```bash
git clone https://github.com/amlzq/csle-diagnostic.git
cd csle-diagnostic
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

Sources are in `src/` and compile to `out/`; localized strings are in `l10n/` and `package.nls.*.json`.

## Before opening a PR

```bash
npm run lint
npm run test:unit
npm test
```

Please add or update tests for behavior changes and add an entry to `CHANGELOG.md`
under `Unreleased`.

## Commit and PR title convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short summary
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **scope**: `scan`, `diagnostics`, `quickfix`, `dictionary`, `panel` or `l10n`
  (optional when a change spans several areas)
- Append `!` for breaking changes, e.g. `refactor(panel)!: drop the dictionary file path`

PR titles follow the same convention.

## Reporting issues

Use the issue templates under `.github/ISSUE_TEMPLATE/`.
