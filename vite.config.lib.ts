import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { resolve } from 'path';

const srcDir = resolve(__dirname, 'src');

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/we/index.ts'),
      name: 'WE3D',
      formats: ['es', 'cjs'],
      fileName: (format) => `we3d.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      // 外部化 node_modules 中的第三方依赖，打包项目内部代码
      external: (id) => {
        // 不外部化 raw 导入（.wgsl?raw 等）
        if (id.includes('?raw')) return false;
        // 外部化 node_modules 中的包
        if (id.includes('node_modules')) return true;
        // 不外部化项目源码目录（Windows 路径兼容）
        if (id.includes('src/we') || id.includes('src\\we')) return false;
        // 不外部化相对路径导入
        if (id.startsWith('.')) return false;
        // 其他 bare specifier 视为外部依赖
        return true;
      },
    },
    target: 'es2022',
    minify: false, // 保持可读性，用户可自行压缩
    copyPublicDir: false, // 库构建不需要复制 public 目录
  },
});
