import { defineConfig, globalIgnores } from 'eslint/config'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default defineConfig([
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      'no-console': 'error',
    },
  },
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),
])
