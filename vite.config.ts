import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // 全部相对路径，任意子路径下都能工作（GitHub Pages 项目站点形如 /<repo>/）
  base: './',
  plugins: [react(), viteSingleFile()],
  server: {
    port: 5180,
    open: false,
  },
  build: {
    target: 'es2020',
    // JS / CSS / 小图标全部内联进 index.html；
    // 唯一不内联的是 public/media/sample.webp——它不走打包，所以这里不用管
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
