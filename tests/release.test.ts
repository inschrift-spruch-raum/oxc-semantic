import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const TEST_TIMEOUT = 30_000
const PACK_BUFFER_SIZE = 4_194_304

interface PackResult {
  files: { path: string }[]
}

interface RootManifest {
  exports: Record<string, unknown>
  files: string[]
  main?: string
  napi: { targets: string[] }
  types?: string
}

type JsonRecord = Record<string, unknown>

const EXPORT_KEYS = ['.', './package.json']

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isPackResult(value: unknown): value is PackResult {
  if (!isRecord(value)) {
    return false
  }
  const { files } = value
  return (
    Array.isArray(files)
    && files.every((file) => isRecord(file) && typeof file.path === 'string')
  )
}

function isRootManifest(value: unknown): value is RootManifest {
  if (!isRecord(value)) {
    return false
  }
  const { exports, files, napi } = value
  return (
    isRecord(exports)
    && isStringArray(files)
    && isRecord(napi)
    && isStringArray(napi.targets)
  )
}

function readJson<Value>(
  path: string,
  guard: (value: unknown) => value is Value,
): Value {
  const content = readFileSync(path, 'utf8')
  const value: unknown = JSON.parse(content)
  if (!guard(value)) {
    throw new TypeError(`Invalid JSON shape in ${path}`)
  }
  return value
}

function packFiles(cwd: string): string[] {
  let command = 'pnpm'
  let commandArguments = ['pack', '--dry-run', '--json']
  if (process.platform === 'win32') {
    command = 'cmd.exe'
    commandArguments = ['/d', '/s', '/c', 'pnpm', ...commandArguments]
  }
  const stdout = execFileSync(command, commandArguments, {
    cwd,
    encoding: 'utf8',
    maxBuffer: PACK_BUFFER_SIZE,
    timeout: TEST_TIMEOUT,
    windowsHide: true,
  })
  const parsed: unknown = JSON.parse(stdout)
  if (!isPackResult(parsed)) {
    throw new TypeError('pnpm pack returned an invalid JSON shape')
  }
  return parsed.files.map((value) => value.path)
}

function testWasiTargetConfiguration(): void {
  expect.hasAssertions()

  const manifest = readJson('package.json', isRootManifest)

  expect(manifest.napi.targets).toStrictEqual(['wasm32-wasip1-threads'])
}

function testRootExports(): void {
  expect.hasAssertions()

  const manifest = readJson('package.json', isRootManifest)
  const exportKeysPresent = EXPORT_KEYS.map((key) =>
    Object.hasOwn(manifest.exports, key),
  )
  expect(exportKeysPresent).toStrictEqual([true, true])
  expect(manifest.main).toBe('./dist/lib/index.js')
  expect(manifest.types).toBe('./dist/lib/index.d.ts')
}

function testRootPackageContents(): void {
  expect.hasAssertions()

  const manifest = readJson('package.json', isRootManifest)
  const rootFiles = packFiles('.')

  expect(manifest.files).toStrictEqual(
    expect.arrayContaining([
      'dist/lib/index.js',
      'dist/lib/index.d.ts',
      'README.md',
      'LICENSE',
    ]),
  )
  expect(rootFiles).toStrictEqual(
    expect.arrayContaining([
      'dist/lib/index.js',
      'dist/wasm/semantic.wasi-browser.js',
      'dist/wasm/semantic.wasi.cjs',
      'dist/wasm/semantic.wasi.d.cts',
      'dist/wasm/semantic.wasm32-wasi.wasm',
      'dist/wasm/wasi-worker-browser.mjs',
      'dist/wasm/wasi-worker.mjs',
      'README.zh.md',
      'LICENSE',
      'package.json',
    ]),
  )
}

function testRootPayload(): void {
  expect.hasAssertions()

  const files = packFiles('.')
  const wasmFiles = files.filter((file) => file.endsWith('.wasm'))

  expect(wasmFiles).toStrictEqual(['dist/wasm/semantic.wasm32-wasi.wasm'])
  expect(files.filter((file) => file.startsWith('npm/'))).toStrictEqual([])
  expect(files).not.toContain('dist/wasm/browser.js')
}

describe('oxc-semantic WASI release artifacts', () => {
  it(
    'configures only the WASI target',
    { timeout: TEST_TIMEOUT },
    testWasiTargetConfiguration,
  )

  it(
    'keeps root entry fields aligned',
    { timeout: TEST_TIMEOUT },
    testRootExports,
  )

  it(
    'packs root entry files and documentation',
    { timeout: TEST_TIMEOUT },
    testRootPackageContents,
  )

  it(
    'packs one release WASM without embedding the target package',
    { timeout: TEST_TIMEOUT },
    testRootPayload,
  )
})
