import { describe, expect, it } from 'vitest'

import { analyze, analyzeSync, bindingTarget, nativePlatform } from '#src/index'

const TEST_TIMEOUT = 10_000
const FIRST_REFERENCE_ID = 1
const UNRESOLVED_REFERENCE_COUNT = 2
const NO_DIAGNOSTICS = 0
const WASM_TARGET = 'wasm32-wasi'
const ROOT_SCOPE_ID = 0

const semanticSource = [
  'const answer = 42',
  'console.log(answer, missing)',
].join('\n')

async function testSyncAndAsyncAnalysis(): Promise<void> {
  expect.hasAssertions()

  const syncResult = analyzeSync('example.ts', semanticSource, {
    lang: 'ts',
    sourceType: 'module',
  })
  const asyncResult = await analyze('example.ts', semanticSource, {
    lang: 'ts',
    sourceType: 'module',
  })

  expect(asyncResult).toStrictEqual(syncResult)
}

function testSymbolRecords(): void {
  expect.hasAssertions()

  const result = analyzeSync('example.ts', semanticSource, {
    lang: 'ts',
    sourceType: 'module',
  })

  expect(result.symbols).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'answer',
        referenceIds: [FIRST_REFERENCE_ID],
        isUnused: false,
      }),
    ]),
  )
}

function testUnresolvedReferences(): void {
  expect.hasAssertions()

  const result = analyzeSync('example.ts', semanticSource, {
    lang: 'ts',
    sourceType: 'module',
  })

  expect(result.references).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'missing', isUnresolved: true }),
    ]),
  )
  expect(result.references.filter((value) => value.isUnresolved)).toHaveLength(
    UNRESOLVED_REFERENCE_COUNT,
  )
}

function testBindingMetadata(): void {
  expect.hasAssertions()

  expect(bindingTarget()).toBe(WASM_TARGET)
  expect(nativePlatform()).toBe(WASM_TARGET)
}

function testUtf16Ranges(): void {
  expect.hasAssertions()

  const source = ['const café = 1', 'console.log(café, missing)'].join('\n')
  const result = analyzeSync('example.ts', source, {
    lang: 'ts',
    sourceType: 'module',
  })
  const symbol = result.symbols.find((value) => value.name === 'café')
  const reference = result.references.find((value) => value.name === 'café')

  expect(symbol?.range).toStrictEqual({ start: 6, end: 10 })
  expect(reference?.range).toStrictEqual({ start: 27, end: 31 })
}

function testUnresolvedReferenceFiltering(): void {
  expect.hasAssertions()

  const source = ['const café = 1', 'console.log(café, missing)'].join('\n')
  const result = analyzeSync('example.ts', source, {
    lang: 'ts',
    sourceType: 'module',
    includeUnresolved: false,
  })

  expect(result.references.map((value) => value.name)).toStrictEqual(['café'])
}

function testReadReferenceFlag(): void {
  expect.hasAssertions()

  const source = ['const café = 1', 'console.log(café, missing)'].join('\n')
  const result = analyzeSync('example.ts', source, {
    lang: 'ts',
    sourceType: 'module',
  })
  const resolvedReference = result.references.find(
    (value) => value.name === 'café',
  )

  expect(resolvedReference?.flags).toContain('Read')
}

function testLanguageAndSourceTypeOptions(): void {
  expect.hasAssertions()

  const script = analyzeSync('file.js', 'const value = 1\nvalue = 2', {
    lang: 'js',
    sourceType: 'script',
  })
  const commonjs = analyzeSync('file.cjs', 'module.exports = value', {
    lang: 'js',
    sourceType: 'commonjs',
  })
  const ts = analyzeSync('file.ts', 'const value = 1', {
    lang: 'ts',
    sourceType: 'module',
  })
  const tsx = analyzeSync('view.tsx', 'const view = <div />', {
    lang: 'tsx',
    sourceType: 'module',
  })

  expect(script.sourceType).toBe('js/script')
  expect(commonjs.sourceType).toBe('js/commonjs')
  expect(ts.sourceType).toBe('ts/module')
  expect(tsx.sourceType).toBe('tsx/module')
}

function testLanguageOverridePreservesModuleKind(): void {
  expect.hasAssertions()

  const cjs = analyzeSync('file.cjs', 'module.exports = 1', { lang: 'js' })
  const cts = analyzeSync('file.cts', 'module.exports = 1', { lang: 'ts' })
  const mjs = analyzeSync('view.mjs', 'const view = <div />', { lang: 'jsx' })

  expect(cjs.sourceType).toBe('js/commonjs')
  expect(cts.sourceType).toBe('ts/commonjs')
  expect(mjs.sourceType).toBe('jsx/module')
}

function testDeclarationSourceType(): void {
  expect.hasAssertions()

  const source = 'declare const answer: number'
  const moduleResult = analyzeSync('types.d.ts', source, {
    lang: 'dts',
    sourceType: 'module',
  })
  const commonjsResult = analyzeSync('types.d.ts', source, {
    lang: 'dts',
    sourceType: 'commonjs',
  })

  expect(moduleResult.sourceType).toBe('dts')
  expect(commonjsResult.sourceType).toBe('dts')
}

function testWindowsFilenameInference(): void {
  expect.hasAssertions()

  const result = analyzeSync(
    String.raw`C:\types.d.tmp\file.ts`,
    'const answer = 42',
  )

  expect(result.sourceType).toBe('ts/script')
}

function testWriteReferenceFlag(): void {
  expect.hasAssertions()

  const result = analyzeSync('file.js', 'const value = 1\nvalue = 2', {
    lang: 'js',
    sourceType: 'script',
  })
  const [assignmentReference] = result.references

  expect(assignmentReference?.flags).toContain('Write')
}

function testSyntaxDiagnostics(): void {
  expect.hasAssertions()

  const result = analyzeSync('broken.ts', 'const =', {
    lang: 'ts',
    sourceType: 'module',
  })

  const [diagnostic] = result.diagnostics
  expect(result.diagnostics.length).toBeGreaterThan(NO_DIAGNOSTICS)
  expect(diagnostic?.severity).toBe('Error')
  expect(result.scopes).toStrictEqual([])
  expect(result.symbols).toStrictEqual([])
  expect(result.references).toStrictEqual([])
}

function testOxcCompatibleDiagnostics(): void {
  expect.hasAssertions()

  const result = analyzeSync('broken.ts', 'const =', {
    lang: 'ts',
    sourceType: 'module',
  })
  const [diagnostic] = result.diagnostics
  const [label] = diagnostic?.labels ?? []

  expect(diagnostic?.codeframe).toContain('broken.ts')
  expect(diagnostic?.labels).not.toHaveLength(NO_DIAGNOSTICS)
  expect(label?.start).toBeTypeOf('number')
  expect(label?.end).toBeTypeOf('number')
  expect(diagnostic?.severity).toBe('Error')
}

function testOxcDiagnosticHelp(): void {
  expect.hasAssertions()

  const result = analyzeSync('example.js', 'break;', {
    lang: 'js',
    sourceType: 'module',
  })
  const [diagnostic] = result.diagnostics

  expect(diagnostic?.helpMessage).toContain('enclosing iteration')
  expect(diagnostic?.labels).toStrictEqual([{ start: 0, end: 6 }])
}

function testEmptyScopeFlags(): void {
  expect.hasAssertions()

  const result = analyzeSync('scope.js', 'if (condition) { let value = 1 }', {
    lang: 'js',
    sourceType: 'script',
  })
  const block = result.scopes.find((scope) => scope.id !== ROOT_SCOPE_ID)

  expect(block?.flags).toStrictEqual([])
}

describe('oxc-semantic WASI binding', () => {
  it(
    'keeps sync and async semantic results identical',
    { timeout: TEST_TIMEOUT },
    testSyncAndAsyncAnalysis,
  )

  it('returns symbol records', { timeout: TEST_TIMEOUT }, testSymbolRecords)

  it(
    'includes unresolved references by default',
    { timeout: TEST_TIMEOUT },
    testUnresolvedReferences,
  )

  it(
    'reports the loaded WASI artifact',
    { timeout: TEST_TIMEOUT },
    testBindingMetadata,
  )

  it('preserves UTF-16 ranges', { timeout: TEST_TIMEOUT }, testUtf16Ranges)

  it(
    'filters unresolved references when requested',
    { timeout: TEST_TIMEOUT },
    testUnresolvedReferenceFiltering,
  )

  it('marks read references', { timeout: TEST_TIMEOUT }, testReadReferenceFlag)

  it(
    'applies language and source type options',
    { timeout: TEST_TIMEOUT },
    testLanguageAndSourceTypeOptions,
  )

  it(
    'preserves the filename module kind with a language override',
    { timeout: TEST_TIMEOUT },
    testLanguageOverridePreservesModuleKind,
  )

  it(
    'reports declaration source types as dts',
    { timeout: TEST_TIMEOUT },
    testDeclarationSourceType,
  )

  it(
    'infers a TypeScript source type from a Windows filename',
    { timeout: TEST_TIMEOUT },
    testWindowsFilenameInference,
  )

  it(
    'marks write references',
    { timeout: TEST_TIMEOUT },
    testWriteReferenceFlag,
  )

  it(
    'returns diagnostics with empty semantic arrays for syntax errors',
    { timeout: TEST_TIMEOUT },
    testSyntaxDiagnostics,
  )

  it(
    'matches Oxc NAPI diagnostics',
    { timeout: TEST_TIMEOUT },
    testOxcCompatibleDiagnostics,
  )

  it(
    'preserves Oxc NAPI diagnostic help',
    { timeout: TEST_TIMEOUT },
    testOxcDiagnosticHelp,
  )

  it(
    'represents empty scope flags as an empty array',
    { timeout: TEST_TIMEOUT },
    testEmptyScopeFlags,
  )
})
