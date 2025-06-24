import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: false,
    rollupOptions: {
      input: 'index.html',
    },
  },
  ssr: {
    noExternal: [/^@angular/]
  }
});
