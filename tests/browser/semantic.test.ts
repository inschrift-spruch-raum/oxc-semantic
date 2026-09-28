import { describe, expect, it } from 'vitest'

import { analyze, analyzeSync, bindingTarget, nativePlatform } from '#src/index'

const source = 'const answer = 42\nconsole.log(answer, missing)'

describe('oxc-semantic browser binding', () => {
  it('reports an isolated WASI binding', { timeout: 30_000 }, () => {
    expect.hasAssertions()
    expect(globalThis).toHaveProperty('crossOriginIsolated', true)
    expect(bindingTarget()).toBe('wasm32-wasi')
    expect(nativePlatform()).toBe('wasm32-wasi')
  })

  it(
    'keeps synchronous and asynchronous analysis consistent',
    { timeout: 30_000 },
    async () => {
      expect.hasAssertions()
      const syncResult = analyzeSync('browser.ts', source, {
        lang: 'ts',
        sourceType: 'module',
      })
      const asyncResult = await analyze('browser.ts', source, {
        lang: 'ts',
        sourceType: 'module',
      })

      expect(asyncResult).toStrictEqual(syncResult)
      expect(asyncResult.diagnostics).toStrictEqual([])
      expect(asyncResult.symbols.map((symbol) => symbol.name)).toContain(
        'answer',
      )
      expect(
        asyncResult.references.map((reference) => reference.name),
      ).toContain('answer')
    },
  )
})
