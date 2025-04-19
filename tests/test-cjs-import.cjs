#!/usr/bin/env node

/**
 * This script tests that the plugin can be imported in a CommonJS environment.
 */

// Use dynamic import for ESM compatibility
async function runTest() {
  try {
    const plugin = (await import('../dist/cjs/vite-plugin-cli-browser-bridge.cjs')).default

    // Check if the plugin is a function
    if (typeof plugin.default !== 'function') {
      console.error('❌ Test failed: Plugin is not a function');
      process.exit(1);
    }

    // Create a plugin instance
    const pluginInstance = plugin.default();

    // Check if the plugin has the expected properties
    if (pluginInstance.name !== 'vite-plugin-cli-browser-bridge') {
      console.error('❌ Test failed: Plugin name is incorrect');
      process.exit(1);
    }

    if (typeof pluginInstance.configureServer !== 'function') {
      console.error('❌ Test failed: Plugin does not have configureServer method');
      process.exit(1);
    }

    if (typeof pluginInstance.transformIndexHtml !== 'function') {
      console.error('❌ Test failed: Plugin does not have transformIndexHtml method');
      process.exit(1);
    }

    console.log('✅ Test passed: Plugin can be imported in a CommonJS environment');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();
