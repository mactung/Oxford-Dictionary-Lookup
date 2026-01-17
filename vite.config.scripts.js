import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    plugins: [react()],
    build: {
        emptyOutDir: false, // Don't wipe the app build
        outDir: 'dist',
        minify: false,
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.jsx'),
                background: resolve(__dirname, 'src/background/index.js'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
                format: 'iife', // Force self-contained bundle

                // IIFE requires a name for the global variable, but we have multiple inputs.
                // Rollup might complain if we don't name them, but for side-effect scripts it might be ok.
                // Or we use 'es' format with inlineDynamicImports?
                // 'es' format + no splitting is hard with multiple inputs.
                // Let's try 'iife' and see if it works for multiple entry points.
                // If not, we might need to loop over them or use separate configs.
                // Best bet for safety: name property is usually required for IIFE.

                // actually, let's use 'umd' or just standard usage.
                // Wait, standard content script is just a script. IIFE is best.
                // If multiple inputs fail with iife, we'll see.
            }
        }
    },
    define: {
        'process.env.NODE_ENV': '"production"'
    }
})
