import { defineConfig, globalIgnores } from 'eslint/config'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default defineConfig([
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      'no-console': 'error',
      // Force `import type` for type-only symbols. Closes the Bun ESM gotcha
      // discovered in Phase 2: `bun run X.ts` errors on mixed value+type
      // imports while `nest start` (SWC) silently elides the type. Auto-fix
      // splits offenders into separate value vs type-only import statements.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      // Honour the `_`-prefix convention for intentionally unused symbols
      // (e.g. `const { drop: _omit, ...rest } = obj` or stub method args).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),
])
