import WebSocket from "ws";
import { WebSocketServer } from "ws";
import { Plugin, IndexHtmlTransformContext } from "vite";
import open from "open";

interface LogMessage {
  type: "log";
  level: string;
  message: string;
}

interface ResponseMessage {
  type: "response";
  commandId: string;
  result?: string;
  error?: string;
}

interface CommandMessage {
  type: "command";
  command: string;
  commandId: string;
}

interface OpenMessage {
  type: "open";
}

interface CloseMessage {
  type: "close";
}

type BrowserMessage = LogMessage | ResponseMessage;

interface PluginOptions {
  port?: number;
  verbose?: boolean; // If true, log debug browser messages to the Vite dev server console and CLI
}

let wss: WebSocketServer | null = null;
const browserClients: Set<WebSocket> = new Set();

const logStore: BrowserMessage[] = [];
const MAX_LOGS = 1000; // Limit the number of logs to prevent memory issues

function initWebSocketServer(
  port = 3333,
  verbose = false
): WebSocketServer | null {
  try {
    wss = new WebSocketServer({ port });

    wss.on("connection", (ws: WebSocket) => {
      if (verbose) console.log("Browser client connected");
      browserClients.add(ws);

      ws.on("message", (message: WebSocket.Data) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === "log" || data.type === "response") {
            logStore.push(data as BrowserMessage);
            if (logStore.length > MAX_LOGS) {
              logStore.shift(); // Prevent memory issues
            }

            if (data.type === "log") {
              if (verbose)
                console.log(`[Browser Log] ${data.level}: ${data.message}`);
            } else if (data.type === "response") {
              if (verbose)
                console.log(
                  `[Command Response] ${data.commandId}: ${
                    data.result || data.error
                  }`
                );

              browserClients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(message.toString());
                }
              });
            }
          } else if (
            data.type === "command" ||
            data.type === "reload" ||
            data.type === "open" ||
            data.type === "close"
          ) {
            if (verbose)
              console.log(`Forwarding ${data.type} message to browser clients`);
            browserClients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
              }
            });
          }
        } catch (error) {
          if (verbose)
            console.error("Error processing message from browser:", error);
        }
      });

      ws.on("close", () => {
        if (verbose) console.log("Browser client disconnected");
        browserClients.delete(ws);
      });
    });

    if (verbose) console.log(`WebSocket server started on port ${port}`);
    return wss;
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      if (verbose)
        console.warn(
          `Port ${port} is already in use. Using a different port...`
        );
      return initWebSocketServer(port + 1, verbose); // Recursively try next port
    } else {
      if (verbose) console.error("Failed to start WebSocket server:", error);
      return null;
    }
  }
}

let verboseOutput = true;

export function setVerbose(verbose: boolean): void {
  verboseOutput = verbose;
}

export function sendCommand(command: string, commandId: string): boolean {
  if (!wss) {
    if (verboseOutput) console.error("WebSocket server not initialized");
    return false;
  }

  const message: CommandMessage = {
    type: "command",
    command,
    commandId,
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

export function getLogs(): BrowserMessage[] {
  return [...logStore];
}

export function clearLogs(): boolean {
  logStore.length = 0;
  return true;
}

export default function vitePluginCliBrowserBridge(
  options: PluginOptions = {}
): Plugin {
  const port = options.port || 3333;
  const verbose = options.verbose || false;
  let server: WebSocketServer | null = null;

  setVerbose(verbose);

  return {
    name: "vite-plugin-cli-browser-bridge",
    apply: "serve", // No-op in build mode

    configureServer(viteServer) {
      server = initWebSocketServer(port, verbose);

      // Modify the WebSocket server to handle the 'open' command
      if (server) {
        server.on("connection", (ws) => {
          ws.on("message", (message) => {
            try {
              const data = JSON.parse(message.toString());

              if (data.type === "open") {
                // Store the Vite server URL for later use
                const address = viteServer.httpServer?.address();
                if (address && typeof address !== "string") {
                  const protocol = "http";
                  const hostname =
                    address.address === "::1" ? "localhost" : address.address;
                  const port = address.port;
                  const viteServerUrl = `${protocol}://${hostname}:${port}`;
                  if (verbose) console.log(`Vite server URL: ${viteServerUrl}`);
                  open(viteServerUrl);
                }
              }
            } catch (error) {
              // Error already handled in the main message handler
            }
          });
        });
      }
    },

    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext): string {
      if (ctx.server === undefined) {
        return html;
      }

      const wsClientScript = `
        <script>
          (function() {
            const ws = new WebSocket('ws://localhost:${port}');

            const originalConsole = {
              log: console.log,
              warn: console.warn,
              error: console.error,
              info: console.info
            };

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

            function sendLog(level, message) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'log',
                  level,
                  message
                }));
              }
            }

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
                  try {
                    const result = eval(data.command);

                    ws.send(JSON.stringify({
                      type: 'response',
                      commandId: data.commandId,
                      result: typeof result === 'object' ? JSON.stringify(result) : String(result)
                    }));
                  } catch (error) {
                    ws.send(JSON.stringify({
                      type: 'response',
                      commandId: data.commandId,
                      error: error.message
                    }));
                  }
                } else if (data.type === 'reload') {
                  window.location.reload();
                } else if (data.type === 'close') {
                  window.close();
                }
              } catch (error) {
                console.error('Error processing message:', error);
              }
            };

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

      return html.replace("</head>", `${wsClientScript}</head>`);
    },

    closeBundle() {
      if (server) {
        server.close();
        if (verbose) console.log("WebSocket server closed");
      }
    },
  };
}
