import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
    },
    preload: {
        input: 'src/preload/preload.js',
        plugins: [externalizeDepsPlugin()],
    },
    renderer: {
        plugins: [
            vue(),
            tailwindcss(),
        ],
    },
})
