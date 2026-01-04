import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import react from '@vitejs/plugin-react'

const cesiumSource = 'node_modules/cesium/Build/Cesium'
const cesiumBaseUrl = 'cesium'

export default defineConfig({
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
                { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
                { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
                { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
            ],
        }),
    ],
    define: {
        CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl),
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                howToPlay: resolve(__dirname, 'how-to-play.html'),
                play: resolve(__dirname, 'play.html'),
                create3dModels: resolve(__dirname, 'create-3d-models.html'),
                exploreWorld: resolve(__dirname, 'explore-the-world.html'),
                cesiumRefactor: resolve(__dirname, 'cesium-refactor.html'),
                cesiumModular: resolve(__dirname, 'cesium-modular.html'),
                eiffelTower: resolve(__dirname, 'explore-the-world/destinations/eiffel-tower-paris.html'),
                grandCanyon: resolve(__dirname, 'explore-the-world/destinations/grand-canyon-usa.html'),
                bali: resolve(__dirname, 'explore-the-world/destinations/bali-indonesia.html'),
                santorini: resolve(__dirname, 'explore-the-world/destinations/santorini-greece.html')
            }
        }
    },
    server: {
        proxy: {
            '/api': {
                target: 'https://api.playglenn.com',
                ws: true,
                changeOrigin: true,
            },
            '/uploads': {
                target: 'https://api.playglenn.com',
                changeOrigin: true,
            },
        }
    }
})