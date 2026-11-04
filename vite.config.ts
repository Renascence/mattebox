import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // 产物是单文件 dist/index.html，所有资源内联，相对路径即可在任意子路径下工作
  // （GitHub Pages 项目站点形如 /<repo>/，不需要额外配置 base）
  base: './',
  plugins: [react(), viteSingleFile()],
  server: {
    port: 5180,
    open: false,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
