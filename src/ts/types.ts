/** Control how Oxc parses source and returns references. */
interface AnalyzeOptions {
  /** Language override that preserves the filename's module kind. */
  lang?: 'js' | 'jsx' | 'ts' | 'tsx' | 'dts'
  /** Module kind override; otherwise inferred by Oxc. */
  sourceType?: 'script' | 'module' | 'commonjs' | 'unambiguous'
  /** Include references without a resolved symbol. Defaults to `true`. */
  includeUnresolved?: boolean
}

/** Zero-based, end-exclusive UTF-16 code-unit offsets. */
interface Range {
  /** Offset of the first code unit. */
  start: number
  /** Offset immediately after the last code unit. */
  end: number
}

/** A diagnostic label with UTF-16 offsets into the analyzed source. */
interface DiagnosticLabel {
  /** Explanation attached to this label, when supplied by Oxc. */
  message?: string
  /** Zero-based start offset. */
  start: number
  /** End-exclusive offset. */
  end: number
}

/** Parser or semantic diagnostic in Oxc NAPI-compatible form. */
interface Diagnostic {
  /** Oxc diagnostic severity. */
  severity: 'Error' | 'Warning' | 'Advice'
  /** Main diagnostic message. */
  message: string
  /** Source labels with UTF-16 offsets. */
  labels: DiagnosticLabel[]
  /** Suggested action, when Oxc provides one. */
  helpMessage?: string
  /** Rendered source excerpt, when available. */
  codeframe?: string
}

/** One lexical scope in Oxc's semantic graph. */
interface Scope {
  /** Scope ID within this result. */
  id: number
  /** Enclosing scope ID; absent for the root scope. */
  parentId?: number
  /** AST node ID that owns this scope. */
  nodeId: number
  /** Oxc scope flags; empty when no bits are set. */
  flags: string[]
  /** IDs of symbols declared in this scope. */
  symbolIds: number[]
}

/** A declared symbol and its resolved references. */
interface SymbolRecord {
  /** Symbol ID within this result. */
  id: number
  /** Declared name. */
  name: string
  /** UTF-16 range of the declaration name. */
  range: Range
  /** Scope containing the declaration. */
  scopeId: number
  /** AST node ID of the declaration. */
  declarationNodeId: number
  /** Oxc symbol flags; empty when no bits are set. */
  flags: string[]
  /** IDs of references resolved to this symbol. */
  referenceIds: number[]
  /** Whether a reference writes to this symbol. */
  isMutated: boolean
  /** Whether Oxc considers this symbol unused. */
  isUnused: boolean
}

/** A use of an identifier in the analyzed source. */
interface Reference {
  /** Reference ID within this result. */
  id: number
  /** Referenced name. */
  name: string
  /** UTF-16 range of the identifier. */
  range: Range
  /** AST node ID of this use. */
  nodeId: number
  /** Scope containing this use. */
  scopeId: number
  /** Resolved symbol ID; absent when unresolved. */
  symbolId?: number
  /** Oxc reference flags; empty when no bits are set. */
  flags: string[]
  /** Whether no declaration resolved this reference. */
  isUnresolved: boolean
}

/** JSON-compatible view of Oxc's semantic analysis. */
interface AnalyzeResult {
  /**
   * Parsed language and module kind, such as `ts/module`; definitions report
   * `dts`.
   */
  sourceType: string
  /** Lexical scopes in the semantic graph. */
  scopes: Scope[]
  /** Declared symbols. */
  symbols: SymbolRecord[]
  /** Identifier references, including unresolved ones by default. */
  references: Reference[]
  /** Parser and semantic diagnostics. */
  diagnostics: Diagnostic[]
}

/** Binding flavor used by every supported runtime. */
type BindingTarget = 'wasm32-wasi'

/** Functions exposed by the generated WASI binding. */
interface SemanticBinding {
  /** Analyze on a WASI worker and return the result asynchronously. */
  analyze: (
    filename: string,
    sourceText: string,
    options?: AnalyzeOptions,
  ) => Promise<AnalyzeResult>
  /** Analyze on the calling thread. */
  analyzeSync: (
    filename: string,
    sourceText: string,
    options?: AnalyzeOptions,
  ) => AnalyzeResult
  /** Report the loaded binding flavor. */
  bindingTarget: () => string
  /** Legacy binding-flavor alias. */
  nativePlatform: () => string
}

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
}
