import { Router, Request, Response } from 'express';
import { SessionManager } from '../session-manager.js';

export function createSessionRoutes(sessionManager: SessionManager): Router {
  const router = Router();

  // Create a new session
  router.post('/', (req: Request, res: Response) => {
    try {
      const metadata = req.body.metadata;
      const session = sessionManager.createSession(metadata);

      res.json({
        sessionId: session.id,
        createdAt: session.createdAt,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to create session',
        code: 'SESSION_CREATE_ERROR',
        details: error.message,
      });
    }
  });

  // Get session info
  router.get('/:sessionId', (req: Request, res: Response) => {
    try {
      const session = sessionManager.getSession(req.params.sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      res.json(session);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get session',
        code: 'SESSION_GET_ERROR',
        details: error.message,
      });
    }
  });

  // List all sessions
  router.get('/', (req: Request, res: Response) => {
    try {
      const sessions = sessionManager.listSessions();
      res.json({ sessions });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to list sessions',
        code: 'SESSION_LIST_ERROR',
        details: error.message,
      });
    }
  });

  // Delete a session
  router.delete('/:sessionId', (req: Request, res: Response) => {
    try {
      const deleted = sessionManager.deleteSession(req.params.sessionId);

      if (!deleted) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to delete session',
        code: 'SESSION_DELETE_ERROR',
        details: error.message,
      });
    }
  });

  return router;
}
