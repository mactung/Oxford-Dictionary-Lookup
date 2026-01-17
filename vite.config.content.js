import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    plugins: [react()],
    build: {
        emptyOutDir: false, // Don't wipe the dist
        outDir: 'dist',
        minify: false,
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.jsx'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                // content script must be one file, so inline everything
                inlineDynamicImports: true,
                format: 'iife',
                name: 'ContentScript', // Global variable name, required for IIFE
                extend: true
            }
        }
    },
    define: {
        'process.env.NODE_ENV': '"production"'
    }
})
