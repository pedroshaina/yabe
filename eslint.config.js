import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/src/generated/**', '**/coverage/**', 'yabe-backend/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
)
