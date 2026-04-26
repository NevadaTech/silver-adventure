import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    projects: [
      {
        name: 'unit',
        test: {
          globals: true,
          environment: 'node',
          include: [
            '__tests__/unit/**/*.{test,spec}.{ts,tsx}',
            '__tests__/core/**/*.{test,spec}.{ts,tsx}',
            'core/**/*.{test,spec}.{ts,tsx}',
          ],
        },
      },
      {
        name: 'integration',
        test: {
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['__tests__/integration/**/*.{test,spec}.{ts,tsx}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['core/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.config.{ts,mts,js,mjs}',
        '**/*.d.ts',
        'vitest.setup.ts',
        'core/shared/infrastructure/supabase/database.types.ts',
        'core/shared/infrastructure/theme/ThemeProvider.tsx',
        'core/shared/infrastructure/swr/SWRProvider.tsx',
        'core/shared/infrastructure/supabase/server.ts',
        'core/shared/infrastructure/theme/ThemeToggle.tsx',
        'core/shared/infrastructure/i18n/LocaleSwitcher.tsx',
        'core/users/infrastructure/components/UserList.tsx',
        'core/users/infrastructure/hooks/useUsers.ts',
        'core/shared/infrastructure/logger/serverLogger.ts',
        'core/shared/infrastructure/logger/clientLogger.ts',
        'core/shared/infrastructure/logger/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
