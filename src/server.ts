import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { config, validateConfig } from './config.js';
import { SessionManager } from './session-manager.js';
import { ClaudeHandler } from './handlers/claude-handler.js';
import { FileHandler } from './handlers/file-handler.js';
import { TerminalHandler } from './handlers/terminal-handler.js';
import { ClaudeWebSocketServer } from './websocket-server.js';
import { authenticateApiKey, rateLimit } from './middleware/auth.js';
import { createSessionRoutes } from './routes/session-routes.js';
import { createChatRoutes } from './routes/chat-routes.js';
import { createFileRoutes } from './routes/file-routes.js';
import { createTerminalRoutes } from './routes/terminal-routes.js';

class RemoteClaudeServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private claudeHandler: ClaudeHandler;
  private fileHandler: FileHandler;
  private terminalHandler: TerminalHandler;
  private wsServer: ClaudeWebSocketServer;

  constructor() {
    // Validate configuration
    validateConfig();

    // Initialize Express app
    this.app = express();

    // Initialize HTTP server
    this.httpServer = createServer(this.app);

    // Initialize WebSocket server
    this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' });

    // Initialize managers and handlers
    this.sessionManager = new SessionManager();
    this.claudeHandler = new ClaudeHandler();
    this.fileHandler = new FileHandler();
    this.terminalHandler = new TerminalHandler();

    // Initialize WebSocket server
    this.wsServer = new ClaudeWebSocketServer(
      this.wss,
      this.sessionManager,
      this.claudeHandler,
      this.fileHandler,
      this.terminalHandler,
    );

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: config.security.allowedOrigins,
        credentials: true,
      }),
    );

    // Body parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });

    // Apply authentication and rate limiting to all API routes
    this.app.use('/api', authenticateApiKey);
    this.app.use('/api', rateLimit);
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        workspace: config.claude.workspaceRoot,
      });
    });

    // API routes
    this.app.use('/api/sessions', createSessionRoutes(this.sessionManager));
    this.app.use('/api/chat', createChatRoutes(this.sessionManager, this.claudeHandler));
    this.app.use('/api/files', createFileRoutes(this.fileHandler));
    this.app.use('/api/terminal', createTerminalRoutes(this.terminalHandler));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: err.message,
      });
    });
  }

  public start(): void {
    this.httpServer.listen(config.server.port, config.server.host, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('  Remote Claude Code API Server');
      console.log('='.repeat(60));
      console.log('');
      console.log(`  HTTP API:    http://${config.server.host}:${config.server.port}`);
      console.log(`  WebSocket:   ws://${config.server.host}:${config.server.port}/ws`);
      console.log(`  Workspace:   ${config.claude.workspaceRoot}`);
      console.log('');
      console.log('  Endpoints:');
      console.log('    GET  /health');
      console.log('    POST /api/sessions');
      console.log('    GET  /api/sessions');
      console.log('    POST /api/chat');
      console.log('    POST /api/files/read');
      console.log('    POST /api/files/write');
      console.log('    POST /api/files/edit');
      console.log('    POST /api/files/delete');
      console.log('    POST /api/terminal/execute');
      console.log('');
      console.log('='.repeat(60));
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private shutdown(): void {
    console.log('\nShutting down gracefully...');

    this.sessionManager.destroy();

    this.httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }
}

// Start the server
const server = new RemoteClaudeServer();
server.start();
