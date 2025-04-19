#!/usr/bin/env node

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

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

// Connect to the Vite plugin's WebSocket server
function connectToWebSocketServer(port = 3333): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on('open', () => {
      console.log(`Connected to WebSocket server on port ${port}`);
      resolve(ws);
    });

    ws.on('error', (error: Error) => {
      console.error(`Failed to connect to WebSocket server on port ${port}:`, error.message);
      reject(error);
    });

    ws.on('message', (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString()) as BrowserMessage;
        if (data.type === 'log') {
          console.log(`[Browser Log] ${data.level}: ${data.message}`);
        } else if (data.type === 'response') {
          console.log(`[Command Response] ${data.commandId}: ${data.result || data.error}`);
        }
      } catch (error) {
        console.error('Error processing message from browser:', error);
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
async function sendCommandToBrowser(command: string, commandId: string, port = 3333): Promise<boolean> {
  try {
    const ws = await connectToWebSocketServer(port);

    const message: CommandMessage = {
      type: 'command',
      command,
      commandId
    };

    ws.send(JSON.stringify(message));
    console.log(`Command sent with ID: ${commandId}`);

    // Keep the connection open for a while to receive the response
    return new Promise((resolve) => {
      setTimeout(() => {
        ws.close();
        resolve(true);
      }, 2000);
    });
  } catch (error: any) {
    console.error('Failed to send command:', error.message);
    return false;
  }
}

// Send reload command to the browser
async function sendReloadCommand(port = 3333): Promise<boolean> {
  try {
    const ws = await connectToWebSocketServer(port);

    const message: ReloadMessage = {
      type: 'reload'
    };

    ws.send(JSON.stringify(message));
    console.log('Reload command sent');

    // Close the connection after sending the command
    ws.close();
    return true;
  } catch (error: any) {
    console.error('Failed to send reload command:', error.message);
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
  .action(async (command: string, options: { port: string }) => {
    const port = parseInt(options.port, 10);
    const commandId = uuidv4();
    const sent = await sendCommandToBrowser(command, commandId, port);

    if (!sent) {
      console.error('Failed to send command to browser');
      process.exit(1);
    }
  });

// Command to execute JavaScript with formatted output
program
  .command('run <command>')
  .description('Execute JavaScript with formatted output (ideal for AI tools)')
  .option('-p, --port <port>', 'WebSocket server port', '3333')
  .action(async (command: string, options: { port: string }) => {
    const port = parseInt(options.port, 10);
    const commandId = uuidv4();
    const sent = await sendCommandToBrowser(command, commandId, port);

    if (!sent) {
      console.error('Failed to send command to browser');
      process.exit(1);
    }
  });

// Command to reload the browser
program
  .command('reload')
  .description('Reload the browser')
  .option('-p, --port <port>', 'WebSocket server port', '3333')
  .action(async (options: { port: string }) => {
    const port = parseInt(options.port, 10);
    const sent = await sendReloadCommand(port);

    if (!sent) {
      console.error('Failed to send reload command to browser');
      process.exit(1);
    }
  });

program.parse(process.argv);
