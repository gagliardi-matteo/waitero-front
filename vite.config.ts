import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: 'src', // Vite parte da src/
  plugins: [tsconfigPaths()],
  build: {
    outDir: '../dist/client', // esce fuori da src
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html', // index in src/
    },
  },
  ssr: {
    noExternal: [/^@angular/],
  },
});
