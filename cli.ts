#!/usr/bin/env node

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { stdout, stderr } from 'process';

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

interface CustomWebSocket extends WebSocket {
  eventEmitter: EventEmitter;
}

function connectToWebSocketServer(port = 3333, verbose = false): Promise<CustomWebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`) as CustomWebSocket;
    ws.eventEmitter = new EventEmitter();

    ws.on('open', () => {
      resolve(ws);
    });

    ws.on('error', (error: Error) => {
      reject(error);
    });

    ws.on('message', (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString()) as BrowserMessage;
        if (data.type === 'log') {
          if (verbose) console.log(`[Browser] ${data.level}: ${data.message}`);
        } else if (data.type === 'response') {
          if (verbose) console.log(`[Response] ${data.result || data.error}`);

          if (data.result) {
            process.stdout.write(data.result);
            if (!data.result.endsWith('\n')) {
              process.stdout.write('\n');
            }
          }

          if (data.error) {
            process.stderr.write(data.error);
            if (!data.error.endsWith('\n')) {
              process.stderr.write('\n');
            }
          }

          ws.eventEmitter.emit('command-response', data.commandId);
        }
      } catch (error) {
        if (verbose) console.error('Error processing message:', error);
      }
    });

    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// Ensures stdout/stderr are flushed before exiting
function safeExit(code = 0): void {
  const stdoutFlushed = stdout.write('');
  const stderrFlushed = stderr.write('');

  if (stdoutFlushed && stderrFlushed) {
    process.exit(code);
  } else {
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

    // Fallback in case drain events don't fire
    setTimeout(() => process.exit(code), 500);
  }
}

async function sendCommandToBrowser(command: string, commandId: string, port = 3333, verbose = false): Promise<boolean> {
  let wsRef: CustomWebSocket | null = null;

  try {
    wsRef = await connectToWebSocketServer(port, verbose);
    const ws = wsRef;

    const message: CommandMessage = {
      type: 'command',
      command,
      commandId
    };

    const responsePromise = new Promise<boolean>((resolve) => {

      const responseHandler = (responseCommandId: string) => {
        if (responseCommandId === commandId) {
          ws.eventEmitter.removeListener('command-response', responseHandler);
          ws.terminate();
          wsRef = null;

          resolve(true);
        }
      };

      ws.eventEmitter.on('command-response', responseHandler);

      // 5-second timeout fallback
      const timeoutId = setTimeout(() => {
        if (!verbose) {
          console.log('Command timed out after 5 seconds');
        }

        ws.eventEmitter.removeListener('command-response', responseHandler);
        ws.terminate();
        wsRef = null;

        resolve(true);
      }, 5000);

      ws.on('close', () => {
        clearTimeout(timeoutId);
        wsRef = null;
        resolve(true);
      });
    });

    ws.send(JSON.stringify(message));

    const result = await responsePromise;

    if (wsRef) {
      wsRef.terminate();
      wsRef = null;
    }

    return result;
  } catch (error: any) {
    console.error('Error:', error.message);

    if (wsRef) {
      wsRef.terminate();
    }
    return false;
  }
}

async function sendReloadCommand(port = 3333, verbose = false): Promise<boolean> {
  let wsRef: CustomWebSocket | null = null;

  try {
    wsRef = await connectToWebSocketServer(port, verbose);
    const ws = wsRef;

    const message: ReloadMessage = {
      type: 'reload'
    };

    ws.send(JSON.stringify(message));

    // Short delay to ensure message is sent before closing
    const result = await new Promise<boolean>((resolve) => {
      setTimeout(() => {
        ws.terminate();
        wsRef = null;
        resolve(true);
      }, 500);
    });

    if (wsRef) {
      wsRef.terminate();
      wsRef = null;
    }

    return result;
  } catch (error: any) {
    console.error('Error:', error.message);

    if (wsRef) {
      wsRef.terminate();
    }
    return false;
  }
}

program
  .name('cli-browser-bridge')
  .description('CLI to send commands to the browser')
  .version('0.1.0');

program
  .command('exec <command>')
  .description('Execute a JavaScript command in the browser (output is automatically formatted)')
  .option('-p, --port <port>', 'WebSocket server port', '3333')
  .option('-v, --verbose', 'Verbose console output')
  .action(async (command: string, options: { port: string, verbose?: boolean }) => {
    const port = parseInt(options.port, 10);
    const verbose = options.verbose || false;
    const commandId = uuidv4();
    const sent = await sendCommandToBrowser(command, commandId, port, verbose);

    if (!sent) {
      console.error('Failed to send command to browser');
      safeExit(1);
    }
    safeExit(0);
  });



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
      console.error('Failed to send reload command to browser');
      safeExit(1);
    }
    safeExit(0);
  });

program.parse(process.argv);
