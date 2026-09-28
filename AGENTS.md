# Contributor Notes

This repository publishes Oxc semantic analysis through a TypeScript API and
Rust WASI/NAPI binding. Keep TypeScript implementation in `src/ts`, Rust sources in
`src/rs`, and build configuration at the project root.

- Keep the toolchain of record consistent: `.oxlintrc.json`, `.oxfmtrc.json`,
  `tsconfig.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, and
  `.github/workflows/`.
- Fix code instead of relaxing rules, and avoid `oxlint-disable` directives
  because warnings are denied.
- Add one tsdown entry and one `exports` entry per published module, and keep
  `main` and `types` pointing at the primary entry.
- Represent optional state with `undefined`; do not introduce `null` sentinels.
- Resolve dependencies from the registry. Do not add `link:`, `file:`, workspace,
  or parent-directory paths. Keep documented paths repository-relative.
- Update `README.md`, `README.zh.md`, affected JSDoc, and tests alongside
  behavior changes.
- Run `pnpm run fmt:check`, `pnpm run lint`, `pnpm test`, and `pnpm run build`
  before publishing changes.
