import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs-extra'

// Custom plugin to copy manifest and create proper structure
const copyExtensionUtils = () => {
    return {
        name: 'copy-extension-utils',
        closeBundle: async () => {
            // Copy manifest
            await fs.copy('src/manifest.json', 'dist/manifest.json');
            // Copy icons if any (skip for now or use placeholders)
        }
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), copyExtensionUtils()],
    build: {
        rollupOptions: {
            input: {
                newtab: resolve(__dirname, 'src/newtab/index.html'),
                background: resolve(__dirname, 'src/background/index.js'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        },
        outDir: 'dist',
    }
})
