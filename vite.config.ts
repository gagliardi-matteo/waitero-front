import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: 'src',
  plugins: [tsconfigPaths()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  ssr: {
    noExternal: [/^@angular/],
  },
});
