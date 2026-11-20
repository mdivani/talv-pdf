import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // The playground renders straight from the package source, so template and engine edits hot-reload.
    // A bare `@resume` maps to the source entry, as in tsconfig, not to package.json's `main` in dist.
    alias: [
      {
        find: /^@resume$/,
        replacement: fileURLToPath(new URL('../packages/resume/index.ts', import.meta.url)),
      },
      {
        find: '@resume',
        replacement: fileURLToPath(new URL('../packages/resume', import.meta.url)),
      },
    ],
  },
  server: {
    open: true,
  },
});
