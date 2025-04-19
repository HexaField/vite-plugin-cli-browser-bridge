import { defineConfig } from 'vite';
import vitePluginCliBrowserBridge from './plugin-wrapper';

export default defineConfig({
  plugins: [
    vitePluginCliBrowserBridge({
      port: 3333
    })
  ]
});
