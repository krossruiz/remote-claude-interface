import { Router, Request, Response } from 'express';
import { SessionManager } from '../session-manager.js';
import { ClaudeHandler } from '../handlers/claude-handler.js';
import { ChatRequest } from '../types.js';

export function createChatRoutes(
  sessionManager: SessionManager,
  claudeHandler: ClaudeHandler,
): Router {
  const router = Router();

  // Send a message to Claude
  router.post('/', async (req: Request, res: Response) => {
    try {
      const chatReq: ChatRequest = req.body;

      if (!chatReq.message) {
        return res.status(400).json({
          error: 'Message is required',
          code: 'INVALID_REQUEST',
        });
      }

      // Create session if not provided
      let sessionId = chatReq.sessionId;
      if (!sessionId) {
        const session = sessionManager.createSession();
        sessionId = session.id;
      } else {
        // Validate session exists
        const session = sessionManager.getSession(sessionId);
        if (!session) {
          return res.status(404).json({
            error: 'Session not found',
            code: 'SESSION_NOT_FOUND',
          });
        }
      }

      // Handle streaming vs non-streaming
      if (chatReq.stream) {
        // Set up SSE (Server-Sent Events) for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await claudeHandler.chat(
          sessionId,
          chatReq.message,
          true,
          {
            onToken: (token: string) => {
              res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
            },
            onComplete: (fullResponse: string) => {
              res.write(
                `data: ${JSON.stringify({ type: 'complete', sessionId, content: fullResponse })}\n\n`,
              );
              res.end();
            },
            onError: (error: Error) => {
              res.write(
                `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`,
              );
              res.end();
            },
          },
        );
      } else {
        // Non-streaming response
        const response = await claudeHandler.chat(sessionId, chatReq.message, false);

        res.json({
          sessionId,
          response,
          completed: true,
        });
      }

      // Update session activity
      sessionManager.updateActivity(sessionId);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to process chat',
        code: 'CHAT_ERROR',
        details: error.message,
      });
    }
  });

  // Get conversation history
  router.get('/history/:sessionId', (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      const history = claudeHandler.getHistory(sessionId);
      res.json({ sessionId, history });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get history',
        code: 'HISTORY_ERROR',
        details: error.message,
      });
    }
  });

  // Clear conversation history
  router.delete('/history/:sessionId', (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      claudeHandler.clearHistory(sessionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to clear history',
        code: 'CLEAR_HISTORY_ERROR',
        details: error.message,
      });
    }
  });

  return router;
}
