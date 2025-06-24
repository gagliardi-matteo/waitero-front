import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  const isSSR = command === 'build';
  return {
    plugins: [angular()],
    build: isSSR
      ? {
          ssr: 'src/main.server.ts',
          outDir: 'dist/server',
          rollupOptions: {
            input: 'src/main.server.ts'
          }
        }
      : {
          outDir: 'dist/client',
          rollupOptions: {
            input: resolve(__dirname, 'src/index.html')
          }
        },
    ssr: {
      external: ['@angular/platform-server']
    }
  };
});
