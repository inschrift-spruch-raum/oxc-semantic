# oxc-semantic

English | [中文](README.zh.md)

`oxc-semantic` exposes Oxc's Rust `SemanticBuilder` through a small, stable
TypeScript API. Every supported runtime uses the same WASI binding built from
Oxc's `oxc_parser` and `oxc_semantic` crates.

Supported runtimes:

- Node.js: Windows x64, Linux x64, and macOS arm64 through WASI
- Web: `wasm32-wasip1-threads`

The package is generated against Oxc `0.151.0`. Upgrade that version only after
checking the upstream AST, semantic, NAPI, and WASI APIs together.

## Install

Install the published package from npm:

```sh
pnpm add oxc-semantic
```

The release workflow publishes the self-contained root tarball to npm. Manual
test builds use the `test` dist-tag and can be installed with
`pnpm add oxc-semantic@test`.

One `wasm32-wasip1-threads` build is used for Node.js and Web. The package's
internal import map selects the browser loader through the `browser` condition.

## Node.js

```ts
import { analyzeSync } from 'oxc-semantic'

const result = analyzeSync(
  'example.ts',
  'const answer = 42\nconsole.log(answer)',
  { lang: 'ts', sourceType: 'module' },
)

console.log(result.symbols)
console.log(result.references)
```

`analyze` has the same arguments and returns a `Promise`. Both functions parse
the source with Oxc and then run `SemanticBuilder`; no source file is read or
modified.

## Web

```ts
import { analyze } from 'oxc-semantic'

const result = await analyze(
  'example.ts',
  'const answer = 42\nconsole.log(answer)',
  { lang: 'ts', sourceType: 'module' },
)
```

The package's internal WASI import resolves to the browser loader in a
bundler. The WASI worker uses shared WebAssembly memory. A browser page must be served from a
secure context with cross-origin isolation (`COOP: same-origin` and
`COEP: require-corp`), which makes `crossOriginIsolated` true.

## API

### `analyzeSync(filename, sourceText, options?)`

Returns an `AnalyzeResult` on the current thread.

### `analyze(filename, sourceText, options?)`

Returns `Promise<AnalyzeResult>`. Node.js and the browser call the WASI async
worker; `analyzeSync` runs on the calling thread.

`options.lang` accepts `js`, `jsx`, `ts`, `tsx`, or `dts`. `options.sourceType`
accepts `script`, `module`, `commonjs`, or `unambiguous`. Set
`includeUnresolved` to `false` to omit references that do not resolve to a
symbol. A language override keeps the filename's module kind unless
`sourceType` is also specified. Filename inference accepts both `/` and `\`
path separators, including Windows paths under WASI.

Every range uses UTF-16 code-unit offsets, matching JavaScript string indices.
The result contains `scopes`, `symbols`, `references`, and parser or semantic
`diagnostics`. Diagnostics match Oxc NAPI's severity, label, helpMessage,
and codeframe fields; flags without set bits are empty arrays. A syntax error
returns diagnostics and empty semantic arrays.
The result's `sourceType` uses a language/module label such as `ts/module`;
TypeScript declaration files report `dts`.

`bindingTarget()` reports `wasm32-wasi`. The legacy `nativePlatform()` API is
also a binding-flavor alias and returns `wasm32-wasi` on every runtime; it does
not report the host operating system.

## Development

Use `pnpm` for JavaScript dependencies and Rust/Cargo for the NAPI crate.
TypeScript sources live in `src/ts`, Rust sources in `src/rs`, and the Cargo
manifest, lockfile, and tool configuration live at the project root:

Build output is consolidated under `dist`: `dist/lib` contains the TypeScript
bundle and declarations, `dist/wasm` contains the WASI runtime files, and
`dist/target` is the Rust build cache. Only `dist/lib` and `dist/wasm` are
included in the package.

```sh
pnpm install
pnpm run build
pnpm run fmt:check
pnpm run lint
pnpm test
```

`build:wasm` creates the Node.js and browser WASI loaders and module. The
release workflow verifies a `v<version>` tag, builds one WASI target, and
publishes the self-contained tarball to npm through the dedicated publish
workflow. The manual test-build workflow publishes to the `test` dist-tag.

The root tarball contains the WASI loader, worker, and one release WASM. The
target binding is an internal implementation detail; consumers use the same
`import 'oxc-semantic'` specifier on Node.js and Web.

The Rust entry is `src/rs/lib.rs`. It is intentionally a view adapter: it
returns JSON-compatible scope, symbol, reference, and diagnostic records
instead of exposing Oxc arena or Rust objects directly.

## License

BSD-3-Clause. The Oxc crates retain their upstream licenses and notices.
