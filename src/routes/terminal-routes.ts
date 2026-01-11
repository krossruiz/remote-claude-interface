import { Router, Request, Response } from 'express';
import { TerminalHandler } from '../handlers/terminal-handler.js';
import { TerminalExecuteRequest } from '../types.js';

export function createTerminalRoutes(terminalHandler: TerminalHandler): Router {
  const router = Router();

  // Execute a terminal command
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const request: TerminalExecuteRequest = req.body;

      if (!request.command) {
        return res.status(400).json({
          error: 'Command is required',
          code: 'INVALID_REQUEST',
        });
      }

      const result = await terminalHandler.execute(request);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to execute command',
        code: 'TERMINAL_EXECUTE_ERROR',
        details: error.message,
      });
    }
  });

  // Execute with streaming (SSE)
  router.post('/execute/stream', async (req: Request, res: Response) => {
    try {
      const request: TerminalExecuteRequest = req.body;

      if (!request.command) {
        return res.status(400).json({
          error: 'Command is required',
          code: 'INVALID_REQUEST',
        });
      }

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await terminalHandler.executeStreaming(
        request,
        (data: string) => {
          res.write(`data: ${JSON.stringify({ type: 'stdout', content: data })}\n\n`);
        },
        (data: string) => {
          res.write(`data: ${JSON.stringify({ type: 'stderr', content: data })}\n\n`);
        },
      );

      res.write(
        `data: ${JSON.stringify({ type: 'complete', result })}\n\n`,
      );
      res.end();
    } catch (error: any) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`,
      );
      res.end();
    }
  });

  return router;
}
