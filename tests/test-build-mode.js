#!/usr/bin/env node

/**
 * This script tests that the plugin is a no-op in build mode.
 * It creates a simple Vite project, adds the plugin, and runs a build.
 * Then it checks that the output HTML doesn't contain the WebSocket client code.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a temporary directory for the test
const testDir = path.join(__dirname, 'test-build');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

// Create a simple index.html
fs.writeFileSync(path.join(testDir, 'index.html'), `
<!DOCTYPE html>
<html>
<head>
  <title>Test Build Mode</title>
</head>
<body>
  <h1>Test Build Mode</h1>
  <script type="module" src="./main.js"></script>
</body>
</html>
`);

// Create a simple main.js
fs.writeFileSync(path.join(testDir, 'main.js'), `
console.log('Hello from main.js');
`);

// Create a vite.config.js that uses the plugin
fs.writeFileSync(path.join(testDir, 'vite.config.js'), `
import { defineConfig } from 'vite';
import vitePluginCliBrowserBridge from '../../dist/esm/vite-plugin-cli-browser-bridge.js';

// Add a console log to verify the plugin is loaded
console.log('Loading vite-plugin-cli-browser-bridge...');

export default defineConfig({
  plugins: [
    vitePluginCliBrowserBridge()
  ],
  logLevel: 'info' // Set log level to info to see plugin loading messages
});
`);

// Create a package.json
fs.writeFileSync(path.join(testDir, 'package.json'), `
{
  "name": "test-build",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "vite build"
  }
}
`);

try {
  // Run the build
  console.log('Installing dependencies...');
  execSync('npm install', { cwd: testDir, stdio: 'inherit' });

  console.log('Building the project...');
  // Capture the build output to verify the plugin is loaded
  const buildOutput = execSync('npm run build', { cwd: testDir }).toString();

  // Check if the plugin was loaded
  if (!buildOutput.includes('vite-plugin-cli-browser-bridge')) {
    console.error('❌ Test failed: Plugin was not loaded during build');
    console.log('Build output:', buildOutput);
    process.exit(1);
  } else {
    console.log('✅ Plugin was loaded during build');
  }

  // Check the output HTML
  const outputHtml = fs.readFileSync(path.join(testDir, 'dist', 'index.html'), 'utf-8');

  // Check that the WebSocket client code is not present
  if (outputHtml.includes('WebSocket')) {
    console.error('❌ Test failed: WebSocket client code found in build output');
    process.exit(1);
  } else {
    console.log('✅ Test passed: WebSocket client code not found in build output');
  }
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
} finally {
  // Clean up
  console.log('Cleaning up...');
  fs.rmSync(testDir, { recursive: true, force: true });
}
