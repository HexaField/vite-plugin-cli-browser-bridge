#!/usr/bin/env node

/**
 * This script tests that the plugin can be imported in an ESM environment.
 */

// Use ESM import
import plugin from '../dist/esm/vite-plugin-cli-browser-bridge.js';

// Check if the plugin is a function
if (typeof plugin !== 'function') {
  console.error('❌ Test failed: Plugin is not a function');
  process.exit(1);
}

// Create a plugin instance
const pluginInstance = plugin();

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

console.log('✅ Test passed: Plugin can be imported in an ESM environment');
