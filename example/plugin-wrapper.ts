// This is a simple wrapper to re-export the plugin
// It helps avoid TypeScript errors due to different Vite versions
import { PluginOption } from 'vite';

// We need to use dynamic import to avoid TypeScript errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pluginModule: any = null;

// Try to load the plugin synchronously
try {
  // Using require would be simpler, but we need to stick with ESM
  // This is a workaround to load the module synchronously in ESM
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
    return {
      name: 'vite-plugin-cli-browser-bridge-wrapper-error'
    };
  }

  // Call the actual plugin function with the provided options
  return pluginModule.default(options);
}
