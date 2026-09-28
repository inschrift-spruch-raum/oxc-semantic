import {
  analyzeSync as analyzeSyncWasi,
  analyze as analyzeWasi,
  bindingTarget as bindingTargetWasi,
  nativePlatform as nativePlatformWasi,
} from '#wasm/semantic.wasi'

import type { BindingTarget, SemanticBinding } from './types.ts'

/** Analyze JavaScript or TypeScript source with Oxc's semantic builder. */
const analyze: SemanticBinding['analyze'] = analyzeWasi

/** Analyze source synchronously on the current thread. */
const analyzeSync: SemanticBinding['analyzeSync'] = analyzeSyncWasi

/** Report which WASI artifact was loaded. */
function bindingTarget(): BindingTarget {
  const target = bindingTargetWasi()
  if (target !== 'wasm32-wasi') {
    throw new Error(`Unsupported oxc-semantic binding target: ${target}`)
  }
  return target
}

/** Legacy binding-flavor alias; every runtime reports `wasm32-wasi`. */
const nativePlatform: SemanticBinding['nativePlatform'] = nativePlatformWasi

export type {
  AnalyzeOptions,
  AnalyzeResult,
  BindingTarget,
  Diagnostic,
  DiagnosticLabel,
  Range,
  Reference,
  Scope,
  SemanticBinding,
  SymbolRecord,
} from './types.ts'
export { analyze, analyzeSync, bindingTarget, nativePlatform }
