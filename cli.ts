#!/usr/bin/env node

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { stdout, stderr } from 'process';

// Define types for messages
interface LogMessage {
  type: 'log';
  level: string;
  message: string;
}

interface ResponseMessage {
  type: 'response';
  commandId: string;
  result?: string;
  error?: string;
}

interface CommandMessage {
  type: 'command';
  command: string;
  commandId: string;
}

interface ReloadMessage {
  type: 'reload';
}

type BrowserMessage = LogMessage | ResponseMessage;

// Create a custom WebSocket with event emitter
interface CustomWebSocket extends WebSocket {
  eventEmitter: EventEmitter;
}

// Connect to the Vite plugin's WebSocket server
function connectToWebSocketServer(port = 3333, verbose = false): Promise<CustomWebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`) as CustomWebSocket;
    ws.eventEmitter = new EventEmitter();

    ws.on('open', () => {
      if (verbose) console.log(`Connected to WebSocket server on port ${port}`);
      resolve(ws);
    });

    ws.on('error', (error: Error) => {
      if (verbose) console.error(`Failed to connect to WebSocket server on port ${port}:`, error.message);
      reject(error);
    });

    ws.on('message', (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString()) as BrowserMessage;
        if (data.type === 'log') {
          if (verbose) console.log(`[Browser Log] ${data.level}: ${data.message}`);
        } else if (data.type === 'response') {
          // Log detailed response info only in verbose mode
          if (verbose) console.log(`[Command Response] ${data.commandId}: ${data.result || data.error}`);

          // Always output the result to stdout for piping, regardless of verbose mode
          if (data.result) {
            // In non-verbose mode, ensure the result is visible
            process.stdout.write(data.result);
            // Add a newline if the result doesn't end with one
            if (data.result && !data.result.endsWith('\n')) {
              process.stdout.write('\n');
            }
          }

          if (data.error) {
            process.stderr.write(data.error);
            // Add a newline if the error doesn't end with one
            if (data.error && !data.error.endsWith('\n')) {
              process.stderr.write('\n');
            }
          }

          // Emit a response event that can be listened to
          ws.eventEmitter.emit('command-response', data.commandId);
        }
      } catch (error) {
        if (verbose) console.error('Error processing message from browser:', error);
      }
    });

    // Set a timeout for the connection
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// Safely exit the process after ensuring all output is flushed
function safeExit(code = 0): void {
  // Flush stdout and stderr
  const stdoutFlushed = stdout.write('');
  const stderrFlushed = stderr.write('');

  if (stdoutFlushed && stderrFlushed) {
    process.exit(code);
  } else {
    // If streams are not flushed, wait for drain events
    let stdoutDrained = stdoutFlushed;
    let stderrDrained = stderrFlushed;

    if (!stdoutFlushed) {
      stdout.once('drain', () => {
        stdoutDrained = true;
        if (stderrDrained) process.exit(code);
      });
    }

    if (!stderrFlushed) {
      stderr.once('drain', () => {
        stderrDrained = true;
        if (stdoutDrained) process.exit(code);
      });
    }

    // Fallback exit after 500ms in case drain events don't fire
    setTimeout(() => process.exit(code), 500);
  }
}

// Send command to the browser
async function sendCommandToBrowser(command: string, commandId: string, port = 3333, verbose = false): Promise<boolean> {
  let wsRef: CustomWebSocket | null = null;

  try {
    wsRef = await connectToWebSocketServer(port, verbose);
    const ws = wsRef; // Create a stable reference

    const message: CommandMessage = {
      type: 'command',
      command,
      commandId
    };

    // Create a promise that resolves when we get a response for this specific command
    const responsePromise = new Promise<boolean>((resolve) => {
      // Listen for the response event with this command ID
      const responseHandler = (responseCommandId: string) => {
        if (responseCommandId === commandId) {
          if (verbose) console.log(`Received response for command ID: ${commandId}`);

          // Clean up event listeners
          ws.eventEmitter.removeListener('command-response', responseHandler);

          // Terminate the WebSocket connection
          ws.terminate();
          wsRef = null;

          resolve(true);
        }
      };

      ws.eventEmitter.on('command-response', responseHandler);

      // Add a timeout of 5 seconds as a fallback
      const timeoutId = setTimeout(() => {
        // Always show timeout message, but with different detail levels
        if (verbose) {
          console.log('Command response timeout, terminating connection');
        } else {
          console.log('Command timed out after 5 seconds');
        }

        // Clean up event listeners
        ws.eventEmitter.removeListener('command-response', responseHandler);

        // Terminate the WebSocket connection
        ws.terminate();
        wsRef = null;

        resolve(true);
      }, 5000);

      // Also listen for the WebSocket close event
      ws.on('close', () => {
        clearTimeout(timeoutId);
        wsRef = null;
        resolve(true);
      });
    });

    // Send the command
    ws.send(JSON.stringify(message));
    if (verbose) console.log(`Command sent with ID: ${commandId}`);

    // Wait for the response or timeout
    const result = await responsePromise;

    // Ensure all WebSocket connections are terminated
    if (wsRef) {
      wsRef.terminate();
      wsRef = null;
    }

    return result;
  } catch (error: any) {
    // Always show errors, but with different detail levels
    if (verbose) {
      console.error('Failed to send command:', error.message);
    } else {
      console.error('Error:', error.message);
    }

    if (wsRef) {
      wsRef.terminate();
    }
    return false;
  }
}

// Send reload command to the browser
async function sendReloadCommand(port = 3333, verbose = false): Promise<boolean> {
  let wsRef: CustomWebSocket | null = null;

  try {
    wsRef = await connectToWebSocketServer(port, verbose);
    const ws = wsRef; // Create a stable reference

    const message: ReloadMessage = {
      type: 'reload'
    };

    ws.send(JSON.stringify(message));
    if (verbose) console.log('Reload command sent');

    // For reload, we don't expect a response, so just close after a short delay
    // to allow the message to be sent
    const result = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        ws.terminate();
        wsRef = null;
        resolve(true);
      }, 500); // Short delay for reload command
    });

    // Ensure all WebSocket connections are terminated
    if (wsRef) {
      wsRef.terminate();
      wsRef = null;
    }

    return result;
  } catch (error: any) {
    // Always show errors, but with different detail levels
    if (verbose) {
      console.error('Failed to send reload command:', error.message);
    } else {
      console.error('Error:', error.message);
    }

    if (wsRef) {
      wsRef.terminate();
    }
    return false;
  }
}

// Initialize the CLI
program
  .name('cli-browser-bridge')
  .description('CLI to send commands to the browser')
  .version('0.1.0');

// Command to execute JavaScript in the browser
program
  .command('exec <command>')
  .description('Execute a JavaScript command in the browser')
  .option('-p, --port <port>', 'WebSocket server port', '3333')
  .option('-v, --verbose', 'Verbose console output')
  .action(async (command: string, options: { port: string, verbose?: boolean }) => {
    const port = parseInt(options.port, 10);
    const verbose = options.verbose || false;
    const commandId = uuidv4();
    const sent = await sendCommandToBrowser(command, commandId, port, verbose);

    if (!sent) {
      // Always show failure message
      console.error('Failed to send command to browser');
      safeExit(1);
    }
    // Safely exit the process
    safeExit(0);
  });

// Command to execute JavaScript with formatted output
program
  .command('run <command>')
  .description('Execute JavaScript with formatted output (ideal for AI tools)')
  .option('-p, --port <port>', 'WebSocket server port', '3333')
  .option('-v, --verbose', 'Verbose console output')
  .action(async (command: string, options: { port: string, verbose?: boolean }) => {
    const port = parseInt(options.port, 10);
    const verbose = options.verbose || false;
    const commandId = uuidv4();
    const sent = await sendCommandToBrowser(command, commandId, port, verbose);

    if (!sent) {
      // Always show failure message
      console.error('Failed to send command to browser');
      safeExit(1);
    }
    // Safely exit the process
    safeExit(0);
  });

// Command to reload the browser
program
  .command('reload')
  .description('Reload the browser')
  .option('-p, --port <port>', 'WebSocket server port', '3333')
  .option('-v, --verbose', 'Verbose console output')
  .action(async (options: { port: string, verbose?: boolean }) => {
    const port = parseInt(options.port, 10);
    const verbose = options.verbose || false;
    const sent = await sendReloadCommand(port, verbose);

    if (!sent) {
      // Always show failure message
      console.error('Failed to send reload command to browser');
      safeExit(1);
    }
    // Safely exit the process
    safeExit(0);
  });

program.parse(process.argv);
