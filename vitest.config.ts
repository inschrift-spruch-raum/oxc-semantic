import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  server: {
    hmr: false,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  test: {
    projects: [
      {
        plugins: [],
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/browser/**/*.test.ts'],
          environment: 'node',
          pool: 'forks',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright({
              launchOptions: { headless: true },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
