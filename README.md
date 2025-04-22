# vite-plugin-cli-browser-bridge

A Vite plugin that creates a bridge between CLI tools and the browser, enabling command execution in the browser context from the command line. Ideal for AI assistants, automation tools, and testing frameworks.

## Features

- Execute JavaScript commands in the browser from the command line
- Capture and return browser console logs and command results
- Control browser tabs (open, close, reload) programmatically
- Seamless integration with AI assistants and automation tools

## Installation

```bash
npm install vite-plugin-cli-browser-bridge --save-dev
```

## Setup

Add the plugin to your `vite.config.js` or `vite.config.ts`:

```js
import { defineConfig } from "vite";
import vitePluginCliBrowserBridge from "vite-plugin-cli-browser-bridge";

export default defineConfig({
  plugins: [
    vitePluginCliBrowserBridge({
      port: 3333, // Optional: WebSocket server port (default: 3333)
      verbose: true, // Optional: Verbose console logs (default: false)
    }),
  ],
});
```

> **Note**: This plugin only operates in development mode and is a no-op during production builds.

## Usage

### CLI Commands

Once your Vite server is running with the plugin enabled, you can use the CLI to interact with the browser:

```bash
# Execute JavaScript in the browser
npx cli-browser-bridge exec "window.document.title"

# Reload the browser
npx cli-browser-bridge reload

# Open a new browser tab
npx cli-browser-bridge open

# Close all browser tabs
npx cli-browser-bridge close

# Use verbose mode for verbose console output (useful for debugging)
npx cli-browser-bridge exec --verbose "window.document.title"
```

### Programmatic Usage

You can also use the CLI programmatically in your Node.js scripts:

```js
import { exec } from "child_process";

// Execute a command in the browser
exec(
  'npx cli-browser-bridge exec "window.document.title"',
  (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log(`Result: ${stdout}`);
  }
);
```

## API Reference

### CLI Commands

| Command          | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `exec <command>` | Execute JavaScript in the browser (output is automatically formatted) |
| `reload`         | Force the browser to reload                                           |
| `open`           | Open the Vite development server in the default browser              |
| `close`          | Close all open browser tabs                                           |

### CLI Options

| Option          | Description                             |
| --------------- | --------------------------------------- |
| `-p, --port`    | WebSocket server port (default: 3333)   |
| `-v, --verbose` | Verbose console output (default: false) |

### Browser Functions

The plugin automatically injects these functions into the browser:

- `window.executeCommand(command)`: Execute JavaScript in the browser context

## Use Cases

### AI Assistants

Perfect for AI assistants that need to interact with web applications:

```bash
# AI can get information from the page
npx cli-browser-bridge exec "window.document.title"

# AI can modify the page
npx cli-browser-bridge exec "document.querySelector('h1').textContent = 'Updated by AI'"
```

## How It Works

1. The plugin injects a WebSocket client into your Vite application
2. The WebSocket client connects to a local server (default port: 3333)
3. CLI commands are sent to the same WebSocket server
4. Commands are forwarded to the browser and executed
5. Results are returned to the CLI

## For AI Agents

If you're an AI agent or building tools for AI agents, see [AGENT_HINTS.md](AGENT_HINTS.md) for a concise list of commands and tips specifically designed for LLM usage.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information on how to develop, test, and contribute to this project.

## License

MIT

## Author

[HexaField](https://github.com/HexaField) _(but mostly AugmentCode code assistant)_
