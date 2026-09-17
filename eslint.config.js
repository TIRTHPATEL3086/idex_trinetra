import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Flat config. Three zones, because this repo runs code in three places:
 * Node ESM (server, prisma, test), CommonJS (hardhat + its scripts), and the
 * browser (client).
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'client/node_modules/**',
      'artifacts/**',
      'cache/**',
      'deployments/**',
      'dist/**',
      'client/dist/**',
      'data/**',
    ],
  },

  js.configs.recommended,

  // ---- Node, ESM: server, prisma, test ------------------------------------
  {
    files: ['server/**/*.js', 'prisma/**/*.js', 'test/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ---- Person A's core stubs ----------------------------------------------
  // These export documented, not-yet-implemented signatures (see each file's
  // header). The parameter names ARE the contract, so an unimplemented body
  // legitimately does not reference them. Local vars and imports are still
  // linted; only unused *arguments* are allowed here.
  {
    files: [
      'server/core/watermark.js',
      'server/core/phash.js',
      'server/core/crypto.js',
      'server/core/ecc.js',
      'server/core/psnr.js',
      'server/core/confidence.js',
    ],
    rules: {
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },

  // ---- Node, CommonJS: hardhat config, deploy script, contract tests -------
  {
    files: ['*.cjs', 'scripts/**/*.cjs', 'test/contracts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.mocha },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // ---- Browser: the React client ------------------------------------------
  {
    files: ['client/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2023 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The new JSX transform means React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // ---- Vite/Tailwind configs run in Node ----------------------------------
  {
    files: ['client/*.config.js', 'client/postcss.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
