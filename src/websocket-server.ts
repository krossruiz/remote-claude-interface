import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { SessionManager } from './session-manager.js';
import { ClaudeHandler } from './handlers/claude-handler.js';
import { FileHandler } from './handlers/file-handler.js';
import { TerminalHandler } from './handlers/terminal-handler.js';
import { WebSocketMessage, WebSocketResponse } from './types.js';
import { config } from './config.js';

export class ClaudeWebSocketServer {
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private claudeHandler: ClaudeHandler;
  private fileHandler: FileHandler;
  private terminalHandler: TerminalHandler;

  constructor(
    wss: WebSocketServer,
    sessionManager: SessionManager,
    claudeHandler: ClaudeHandler,
    fileHandler: FileHandler,
    terminalHandler: TerminalHandler,
  ) {
    this.wss = wss;
    this.sessionManager = sessionManager;
    this.claudeHandler = claudeHandler;
    this.fileHandler = fileHandler;
    this.terminalHandler = terminalHandler;

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('New WebSocket connection');

      // Authenticate WebSocket connection
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const apiKey = url.searchParams.get('apiKey');

      if (!apiKey || apiKey !== config.security.apiKey) {
        ws.close(1008, 'Invalid API key');
        return;
      }

      // Set up message handler
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error: any) {
          this.sendError(ws, error.message);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      this.send(ws, {
        type: 'complete',
        payload: {
          message: 'Connected to Claude Code Remote API',
          version: '1.0.0',
        },
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const { type, payload, requestId } = message;

    try {
      switch (type) {
        case 'chat':
          await this.handleChat(ws, payload, requestId);
          break;

        case 'file':
          await this.handleFileOperation(ws, payload, requestId);
          break;

        case 'terminal':
          await this.handleTerminalOperation(ws, payload, requestId);
          break;

        case 'control':
          await this.handleControl(ws, payload, requestId);
          break;

        default:
          this.sendError(ws, `Unknown message type: ${type}`, requestId);
      }
    } catch (error: any) {
      this.sendError(ws, error.message, requestId);
    }
  }

  private async handleChat(ws: WebSocket, payload: any, requestId?: string): Promise<void> {
    const { sessionId, message } = payload;

    if (!message) {
      this.sendError(ws, 'Message is required', requestId);
      return;
    }

    // Create or validate session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const session = this.sessionManager.createSession();
      activeSessionId = session.id;
    } else {
      const session = this.sessionManager.getSession(activeSessionId);
      if (!session) {
        this.sendError(ws, 'Session not found', requestId);
        return;
      }
    }

    // Stream the response
    await this.claudeHandler.chat(activeSessionId, message, true, {
      onToken: (token: string) => {
        this.send(ws, {
          type: 'data',
          requestId,
          payload: {
            sessionId: activeSessionId,
            token,
          },
        });
      },
      onComplete: (fullResponse: string) => {
        this.send(ws, {
          type: 'complete',
          requestId,
          payload: {
            sessionId: activeSessionId,
            response: fullResponse,
          },
        });
      },
      onError: (error: Error) => {
        this.sendError(ws, error.message, requestId);
      },
    });

    this.sessionManager.updateActivity(activeSessionId);
  }

  private async handleFileOperation(
    ws: WebSocket,
    payload: any,
    requestId?: string,
  ): Promise<void> {
    const { operation, ...params } = payload;

    let result: any;

    switch (operation) {
      case 'read':
        result = await this.fileHandler.readFile(params);
        break;

      case 'write':
        await this.fileHandler.writeFile(params);
        result = { success: true };
        break;

      case 'edit':
        await this.fileHandler.editFile(params);
        result = { success: true };
        break;

      case 'delete':
        await this.fileHandler.deleteFile(params);
        result = { success: true };
        break;

      case 'list':
        result = await this.fileHandler.listFiles(params.path);
        break;

      case 'exists':
        result = await this.fileHandler.fileExists(params.path);
        break;

      case 'info':
        result = await this.fileHandler.getFileInfo(params.path);
        break;

      default:
        this.sendError(ws, `Unknown file operation: ${operation}`, requestId);
        return;
    }

    this.send(ws, {
      type: 'complete',
      requestId,
      payload: result,
    });
  }

  private async handleTerminalOperation(
    ws: WebSocket,
    payload: any,
    requestId?: string,
  ): Promise<void> {
    const { command, cwd, timeout, env, stream } = payload;

    if (!command) {
      this.sendError(ws, 'Command is required', requestId);
      return;
    }

    if (stream) {
      const result = await this.terminalHandler.executeStreaming(
        { command, cwd, timeout, env },
        (data: string) => {
          this.send(ws, {
            type: 'data',
            requestId,
            payload: { type: 'stdout', content: data },
          });
        },
        (data: string) => {
          this.send(ws, {
            type: 'data',
            requestId,
            payload: { type: 'stderr', content: data },
          });
        },
      );

      this.send(ws, {
        type: 'complete',
        requestId,
        payload: result,
      });
    } else {
      const result = await this.terminalHandler.execute({ command, cwd, timeout, env });
      this.send(ws, {
        type: 'complete',
        requestId,
        payload: result,
      });
    }
  }

  private async handleControl(
    ws: WebSocket,
    payload: any,
    requestId?: string,
  ): Promise<void> {
    const { action, params } = payload;

    switch (action) {
      case 'createSession':
        const session = this.sessionManager.createSession(params?.metadata);
        this.send(ws, {
          type: 'complete',
          requestId,
          payload: session,
        });
        break;

      case 'deleteSession':
        const deleted = this.sessionManager.deleteSession(params?.sessionId);
        this.send(ws, {
          type: 'complete',
          requestId,
          payload: { success: deleted },
        });
        break;

      case 'listSessions':
        const sessions = this.sessionManager.listSessions();
        this.send(ws, {
          type: 'complete',
          requestId,
          payload: { sessions },
        });
        break;

      case 'ping':
        this.send(ws, {
          type: 'complete',
          requestId,
          payload: { pong: true, timestamp: Date.now() },
        });
        break;

      default:
        this.sendError(ws, `Unknown control action: ${action}`, requestId);
    }
  }

  private send(ws: WebSocket, response: WebSocketResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }

  private sendError(ws: WebSocket, error: string, requestId?: string): void {
    this.send(ws, {
      type: 'error',
      requestId,
      payload: { error },
    });
  }
}
