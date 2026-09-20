import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 2000,
    sourcemap: true,
    minify: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
      },
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/three')) return 'three';
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      '@core': resolve(import.meta.dirname, 'src/core'),
      '@ai': resolve(import.meta.dirname, 'src/ai'),
      '@ui': resolve(import.meta.dirname, 'src/ui'),
      '@types': resolve(import.meta.dirname, 'src/types'),
      '@utils': resolve(import.meta.dirname, 'src/utils'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    open: false,
    https: false,
    cors: true,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  optimizeDeps: {
    include: ['three'],
    exclude: ['@capacitor/core', '@capacitor/filesystem'],
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    __DEV_MODE__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  worker: {
    format: 'es',
  },
});
