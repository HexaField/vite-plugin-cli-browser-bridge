#!/usr/bin/env node

/**
 * This is a simplified interface for AI assistants to interact with the browser.
 * It provides a straightforward way to execute commands and get results.
 */

// Import the compiled CLI to ensure we're using the built version
import('./dist/cli.js').catch(err => {
  console.error('Failed to load the CLI:', err);
  process.exit(1);
});
