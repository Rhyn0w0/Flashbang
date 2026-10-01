// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: ['frontend/tsconfig.json', 'backend/convex/tsconfig.json'],
        },
      },
    },
  },
  {
    ignores: ['**/dist/**', '**/.expo/**', '**/node_modules/**', 'backend/convex/_generated/**'],
  },
]);
