import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', 'tests/__fixtures__/**', 'docs/**']
  },

  js.configs.recommended,

  // ── Renderer (React, browser globals) ──────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The app targets Electron's bundled Chromium, so the new JSX transform
      // is always available and React need not be in scope
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  // ── Main process (CommonJS, Node globals) ──────────────────────────────────
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  // ── Shared geometry (ESM, environment-agnostic) ────────────────────────────
  {
    files: ['shared/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' }
  },

  // ── Scripts, tests and config (ESM, Node globals) ──────────────────────────
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.config.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  // ── PostCSS / Tailwind config (CommonJS-ish, Node globals) ─────────────────
  {
    files: ['postcss.config.js', 'tailwind.config.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
]
