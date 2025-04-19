# Contributing to vite-plugin-cli-browser-bridge

Thank you for considering contributing to this project! This document provides guidelines and instructions for development, testing, and contributing to the repository.

## Repository Structure

The repository is organized as follows:

- **Root Directory**: Contains the core plugin files
  - `vite-plugin-cli-browser-bridge.ts`: Main plugin implementation
  - `cli.ts`: CLI implementation
  - `npx-cli-browser-bridge.js`: Entry point for npx usage

- **`example/`**: Contains a working example of the plugin
  - Demonstrates how to integrate and use the plugin in a Vite project
  - Includes a simple UI for testing commands

- **`tests/`**: Contains test files
  - `test-build-mode.js`: Tests that the plugin is a no-op in build mode

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/HexaField/vite-plugin-cli-browser-bridge.git
   cd vite-plugin-cli-browser-bridge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build:all
   ```

## Testing

### Running Tests

Run all tests:
```bash
npm test
```

This will:
1. Build the plugin
2. Run the build mode test to verify the plugin is a no-op in production builds

### Testing with the Example Project

The example project is useful for manual testing:

1. Navigate to the example directory:
   ```bash
   cd example
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. In a separate terminal, send commands to the browser:
   ```bash
   # From the root directory
   npm run command exec "window.document.title"
   ```

## WebSocket Server

The plugin uses a single WebSocket server:

- **WebSocket Server (default port: 3333)**
  - Created by the Vite plugin
  - Used for console log capturing and command execution
  - The CLI connects to this server to send commands
  - The browser connects to this server to receive commands and send responses

## Build Process

The project uses TypeScript for type safety. The build process compiles TypeScript files to JavaScript:

```bash
# Build the plugin
npm run build:plugin

# Build the CLI
npm run build:cli

# Build both
npm run build:all
```

## TypeScript Configuration

The project uses multiple TypeScript configuration files:

- `tsconfig.json`: Base configuration
- `tsconfig.build.json`: Configuration for building the plugin
- `tsconfig.cli.json`: Configuration for building the CLI

## Publishing

Before publishing, the package runs tests to ensure everything works correctly:

```bash
npm publish
```

This will:
1. Build the plugin and CLI
2. Run tests
3. Publish the package to npm

## Design Decisions

### Development Mode Only

The plugin is designed to be a no-op in production builds. This is intentional to avoid injecting development tools into production code.

### Single WebSocket Server

Using a single WebSocket server for both the plugin and CLI simplifies the architecture and reduces complexity.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.
