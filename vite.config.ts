import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(), 
    topLevelAwait() // 解决 Wasm 初始化时的顶层 await 问题
  ]
});