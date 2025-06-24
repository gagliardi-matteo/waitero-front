import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  root: 'src',
  plugins: [tsconfigPaths()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/index.html'),
    },
  },
  ssr: {
    noExternal: [/^@angular/],
  },
});
