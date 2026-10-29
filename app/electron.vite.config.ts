import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite bundles three independent Vite builds: Node for main/preload,
// browser for the renderer. Entries live under electron/** and src/** (the
// SvelteKit-era layout is gone). index.html sits at the app root so nothing has
// to be added under src/ beyond main.tsx and styles/.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'electron/main/index.ts') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      // A sandboxed preload (sandbox: true) must be CommonJS, emitted as .js.
      lib: {
        entry: resolve(__dirname, 'electron/preload/index.ts'),
        formats: ['cjs']
      },
      rollupOptions: {
        output: { entryFileNames: 'index.js' }
      }
    }
  },
  renderer: {
    root: __dirname,
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    },
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    }
  }
})
