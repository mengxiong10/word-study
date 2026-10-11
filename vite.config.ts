import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 新版本等待所有页面关闭后启用，避免学习过程中自动刷新。
      registerType: 'prompt',
      injectRegister: 'script',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '词间 · 考公词语研习',
        short_name: '词间',
        description: '在语境中辨析成语与实词，学习、练习与间隔复习。',
        lang: 'zh-CN',
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#f6f4ed',
        background_color: '#f6f4ed',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // 完整题库随主包加载，当前约 2.3 MB。
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base: './',
  cacheDir: './.cache/vite',
});
