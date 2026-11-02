import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default defineConfig([
  globalIgnores(['dist/**', '.tools/**']),
  { files: ['**/*.{js,ts,tsx}'], extends: [js.configs.recommended] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  { files: ['src/**/*.{ts,tsx}'], extends: [reactHooks.configs.flat.recommended] },
  { files: ['*.{js,ts}', 'tests/**/*.ts'], languageOptions: { globals: globals.node } },
])
