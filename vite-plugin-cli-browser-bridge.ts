import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import { Plugin, IndexHtmlTransformContext } from 'vite';

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

type BrowserMessage = LogMessage | ResponseMessage;

// Define plugin options
interface PluginOptions {
  port?: number;
  verbose?: boolean; // If true, log debug browser messages to the Vite dev server console and CLI
}

// WebSocket server for communication with the browser
let wss: WebSocketServer | null = null;
const browserClients: Set<WebSocket> = new Set();

// Store for console logs and command responses
const logStore: BrowserMessage[] = [];
const MAX_LOGS = 1000; // Limit the number of logs to prevent memory issues

// Initialize WebSocket server
function initWebSocketServer(port = 3333, verbose = false): WebSocketServer | null {
  try {
    wss = new WebSocketServer({ port });

    wss.on('connection', (ws: WebSocket) => {
      if (verbose) console.log('Browser client connected');
      browserClients.add(ws);

      ws.on('message', (message: WebSocket.Data) => {
        try {
          const data = JSON.parse(message.toString());

          // Handle different message types
          if (data.type === 'log' || data.type === 'response') {
            // Store logs and responses
            logStore.push(data as BrowserMessage);
            if (logStore.length > MAX_LOGS) {
              logStore.shift(); // Remove oldest log if we exceed the limit
            }

            // Print to console
            if (data.type === 'log') {
              if (verbose) console.log(`[Browser Log] ${data.level}: ${data.message}`);
            } else if (data.type === 'response') {
              if (verbose) console.log(`[Command Response] ${data.commandId}: ${data.result || data.error}`);

              // Forward response to all other clients (CLI)
              browserClients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(message.toString());
                }
              });
            }
          } else if (data.type === 'command' || data.type === 'reload') {
            // Forward command/reload messages to all browser clients
            if (verbose) console.log(`Forwarding ${data.type} message to browser clients`);
            browserClients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
              }
            });
          }
        } catch (error) {
          if (verbose) console.error('Error processing message from browser:', error);
        }
      });

      ws.on('close', () => {
        if (verbose) console.log('Browser client disconnected');
        browserClients.delete(ws);
      });
    });

    if (verbose) console.log(`WebSocket server started on port ${port}`);
    return wss;
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      if (verbose) console.warn(`Port ${port} is already in use. Using a different port...`);
      return initWebSocketServer(port + 1, verbose); // Try the next port
    } else {
      if (verbose) console.error('Failed to start WebSocket server:', error);
      return null;
    }
  }
}

// Global verbose option
let verboseOutput = true;

// Set verbose mode
export function setVerbose(verbose: boolean): void {
  verboseOutput = verbose;
}

// Send command to all connected browser clients
export function sendCommand(command: string, commandId: string): boolean {
  if (!wss) {
    if (verboseOutput) console.error('WebSocket server not initialized');
    return false;
  }

  const message: CommandMessage = {
    type: 'command',
    command,
    commandId
  };

  let sent = false;
  browserClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      sent = true;
    }
  });

  return sent;
}

// Get stored logs
export function getLogs(): BrowserMessage[] {
  return [...logStore];
}

// Clear stored logs
export function clearLogs(): boolean {
  logStore.length = 0;
  return true;
}

// Vite plugin
export default function vitePluginCliBrowserBridge(options: PluginOptions = {}): Plugin {
  const port = options.port || 3333;
  const verbose = options.verbose || false;
  let server: WebSocketServer | null = null;

  // Set global verbose option
  setVerbose(verbose);

  return {
    name: 'vite-plugin-cli-browser-bridge',
    apply: 'serve', // Only apply this plugin during development/serve

    configureServer() {
      server = initWebSocketServer(port, verbose);
    },

    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext): string {
      // Only inject in development mode
      if (ctx.server === undefined) {
        return html; // Skip during build
      }

      // Inject WebSocket client code into the HTML
      const wsClientScript = `
        <script>
          (function() {
            // Connect to WebSocket server
            const ws = new WebSocket('ws://localhost:${port}');

            // Store original console methods
            const originalConsole = {
              log: console.log,
              warn: console.warn,
              error: console.error,
              info: console.info
            };

            // Override console methods to capture logs
            console.log = function() {
              originalConsole.log.apply(console, arguments);
              sendLog('log', Array.from(arguments).join(' '));
            };

            console.warn = function() {
              originalConsole.warn.apply(console, arguments);
              sendLog('warn', Array.from(arguments).join(' '));
            };

            console.error = function() {
              originalConsole.error.apply(console, arguments);
              sendLog('error', Array.from(arguments).join(' '));
            };

            console.info = function() {
              originalConsole.info.apply(console, arguments);
              sendLog('info', Array.from(arguments).join(' '));
            };

            // Send log to server
            function sendLog(level, message) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'log',
                  level,
                  message
                }));
              }
            }

            // Handle WebSocket events
            ws.onopen = function() {
              console.log('Connected to CLI browser bridge server');
            };

            ws.onclose = function() {
              console.warn('Disconnected from CLI browser bridge server');
            };

            ws.onerror = function(error) {
              console.error('WebSocket error:', error);
            };

            ws.onmessage = function(event) {
              try {
                const data = JSON.parse(event.data);

                if (data.type === 'command') {
                  // Execute the command
                  try {
                    const result = eval(data.command);

                    // Send the result back
                    ws.send(JSON.stringify({
                      type: 'response',
                      commandId: data.commandId,
                      result: typeof result === 'object' ? JSON.stringify(result) : String(result)
                    }));
                  } catch (error) {
                    // Send the error back
                    ws.send(JSON.stringify({
                      type: 'response',
                      commandId: data.commandId,
                      error: error.message
                    }));
                  }
                } else if (data.type === 'reload') {
                  // Reload the page
                  window.location.reload();
                }
              } catch (error) {
                console.error('Error processing message:', error);
              }
            };

            // Expose a global function to execute commands
            window.executeCommand = function(command) {
              try {
                return eval(command);
              } catch (error) {
                console.error('Error executing command:', error);
                return { error: error.message };
              }
            };
          })();
        </script>
      `;

      return html.replace('</head>', `${wsClientScript}</head>`);
    },

    closeBundle() {
      if (server) {
        server.close();
        if (verbose) console.log('WebSocket server closed');
      }
    }
  };
}
