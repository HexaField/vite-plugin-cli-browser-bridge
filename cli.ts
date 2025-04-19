#!/usr/bin/env node

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

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
          if (verbose) console.log(`[Command Response] ${data.commandId}: ${data.result || data.error}`);
          // Always output the result to stdout for piping
          if (data.result) process.stdout.write(data.result);
          if (data.error) process.stderr.write(data.error);

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

// Send command to the browser
async function sendCommandToBrowser(command: string, commandId: string, port = 3333, verbose = false): Promise<boolean> {
  try {
    const ws = await connectToWebSocketServer(port, verbose);

    const message: CommandMessage = {
      type: 'command',
      command,
      commandId
    };

    // Create a promise that resolves when we get a response for this specific command
    const responsePromise = new Promise<boolean>((resolve) => {
      // Listen for the response event with this command ID
      ws.eventEmitter.on('command-response', (responseCommandId: string) => {
        console.log(`Received response for command ID: ${responseCommandId} from command ID: ${commandId}`);
        if (responseCommandId === commandId) {
          console.log('Closing WebSocket connection...');
          ws.close();
          resolve(true);
        }
      });

      // Add a timeout of 5 seconds as a fallback
      setTimeout(() => {
        ws.close();
        resolve(true);
      }, 5000);
    });

    // Send the command
    ws.send(JSON.stringify(message));
    if (verbose) console.log(`Command sent with ID: ${commandId}`);

    // Wait for the response or timeout
    return responsePromise;
  } catch (error: any) {
    if (verbose) console.error('Failed to send command:', error.message);
    return false;
  }
}

// Send reload command to the browser
async function sendReloadCommand(port = 3333, verbose = false): Promise<boolean> {
  try {
    const ws = await connectToWebSocketServer(port, verbose);

    const message: ReloadMessage = {
      type: 'reload'
    };

    ws.send(JSON.stringify(message));
    if (verbose) console.log('Reload command sent');

    // For reload, we don't expect a response, so just close after a short delay
    // to allow the message to be sent
    return new Promise((resolve) => {
      setTimeout(() => {
        ws.close();
        resolve(true);
      }, 500); // Short delay for reload command
    });
  } catch (error: any) {
    if (verbose) console.error('Failed to send reload command:', error.message);
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
      if (verbose) console.error('Failed to send command to browser');
      process.exit(1);
    }
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
    console.log(sent)

    if (!sent) {
      if (verbose) console.error('Failed to send command to browser');
      process.exit(1);
    }
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
      if (verbose) console.error('Failed to send reload command to browser');
      process.exit(1);
    }
  });

program.parse(process.argv);
