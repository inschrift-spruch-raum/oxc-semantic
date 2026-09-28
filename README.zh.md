# oxc-semantic

[English](README.md) | 中文

`oxc-semantic` 将 Oxc Rust 的 `SemanticBuilder` 暴露为稳定的 TypeScript
API。所有支持的运行时都使用基于 Oxc `oxc_parser` 与 `oxc_semantic` crate
构建的同一个 WASI 绑定。

支持的运行时:

- Node.js: Windows x64、Linux x64、macOS arm64，统一使用 WASI
- Web: `wasm32-wasip1-threads`

当前绑定基于 Oxc `0.151.0` 构建。升级版本时需要同时核对上游 AST、semantic、
NAPI 与 WASI API。

## 安装

从 npm 安装已发布的包:

```sh
pnpm add oxc-semantic
```

发布工作流会把自包含的根包 tarball 发布到 npm。手动测试构建使用 `test`
dist-tag，可执行 `pnpm add oxc-semantic@test` 安装。

Node.js 和 Web 共用同一份 `wasm32-wasip1-threads` 构建。包内部的 imports
条件会让浏览器 bundler 自动选择浏览器 loader。

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

`analyze` 参数相同并返回 `Promise`。两个函数都会用 Oxc 解析源码，再运行
`SemanticBuilder`;不会读取或修改源码文件。

## Web

```ts
import { analyze } from 'oxc-semantic'

const result = await analyze(
  'example.ts',
  'const answer = 42\nconsole.log(answer)',
  { lang: 'ts', sourceType: 'module' },
)
```

浏览器 bundler 会通过包内部 imports 条件选择浏览器 WASI loader。WASI worker 使用共享
WebAssembly memory。浏览器页面必须在安全上下文中，并且启用跨源隔离
(`COOP: same-origin` 与 `COEP: require-corp`)，使 `crossOriginIsolated` 为
`true`。

## API

### `analyzeSync(filename, sourceText, options?)`

在当前线程同步返回 `AnalyzeResult`。

### `analyze(filename, sourceText, options?)`

返回 `Promise<AnalyzeResult>`。Node.js 和浏览器都调用 WASI 异步 worker；
`analyzeSync` 才在调用线程上同步运行。

`options.lang` 支持 `js`、`jsx`、`ts`、`tsx`、`dts`; `options.sourceType` 支持
`script`、`module`、`commonjs`、`unambiguous`。将 `includeUnresolved` 设为
`false` 可以忽略无法解析到 symbol 的引用。指定语言时仍保留从文件名推断的模块
类型，除非同时指定 `sourceType`。文件名推断同时识别 `/` 和 `\` 路径分隔符，
包括 WASI 环境中的 Windows 路径。

所有 range 都使用 UTF-16 code-unit offset，与 JavaScript 字符串下标一致。
结果包含 `scopes`、`symbols`、`references` 以及 parser 或 semantic 的
`diagnostics`。诊断的 severity、label、helpMessage 和 codeframe 与 Oxc NAPI
一致；空 flags 输出空数组。语法错误时返回 diagnostics，语义数组为空。
结果的 `sourceType` 通常使用 `ts/module` 这样的语言/模块标签；TypeScript 声明文件
返回 `dts`。

`bindingTarget()` 返回 `wasm32-wasi`。为兼容旧 API，`nativePlatform()` 也作为
绑定类型别名在各端返回 `wasm32-wasi`，不表示宿主操作系统。

## 开发

JavaScript 运行时和依赖使用 `pnpm`，NAPI crate 使用 Rust/Cargo。TypeScript
源码位于 `src/ts`，Rust 源码位于 `src/rs`，Cargo manifest、lockfile 和工具配置
位于项目根目录:

所有构建产物统一放在 `dist`：`dist/lib` 是 TypeScript bundle 和声明文件，
`dist/wasm` 是 WASI 运行时文件，`dist/target` 是 Rust 编译缓存。发布包只包含
`dist/lib` 和 `dist/wasm`。

```sh
pnpm install
pnpm run build
pnpm run fmt:check
pnpm run lint
pnpm test
```

`build:wasm` 生成 Node.js 和浏览器共用的 WASI loader 与模块。发布工作流会校验
`v<version>` 标签，构建一个 WASI target，并通过独立的发布工作流将自包含根包发布
到 npm。手动测试构建会发布到 `test` dist-tag。

根包 tarball 携带 WASI loader、worker 和一份正式版 WASM。目标绑定包只作为
内部构建产物，不单独发布；Node.js 和 Web 都使用同一个
`import 'oxc-semantic'` 导入方式。

Rust 入口为 `src/rs/lib.rs`。它是一个 view adapter: 返回 JSON 兼容的 scope、
symbol、reference 与 diagnostic 记录，不直接暴露 Oxc arena 或 Rust 对象。

## 许可证

BSD-3-Clause。Oxc crate 继续遵循其上游许可证与声明。
