// Wrapper to avoid TypeScript errors due to different Vite versions
import { PluginOption } from 'vite';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pluginModule: any = null;

try {
  // Workaround to load the module synchronously in ESM
  pluginModule = await import('../dist/esm/vite-plugin-cli-browser-bridge.js');
} catch (error) {
  console.error('Failed to load plugin:', error);
}

interface PluginOptions {
  port?: number;
}

export default function vitePluginCliBrowserBridge(options?: PluginOptions): PluginOption {
  if (!pluginModule || !pluginModule.default) {
    console.error('Plugin module not loaded correctly');
    throw new Error('Plugin module not loaded correctly');
  }

  return pluginModule.default(options);
}
