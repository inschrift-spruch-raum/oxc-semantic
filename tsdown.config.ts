import { defineConfig } from 'tsdown'

/**
 * Build the published library entries directly from `src/ts/`. Add one entry per
 * published module and mirror it in the `exports` map of `package.json`;
 * TypeScript performs the separate no-emit checks, while tsdown owns runtime
 * and declaration output.
 */
export default defineConfig({
  entry: {
    index: 'src/ts/index.ts',
  },
  outDir: 'dist/lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    dts: { neverBundle: true },
    neverBundle: [/wasm[\\/]/],
  },
  tsconfig: 'tsconfig.json',
})
