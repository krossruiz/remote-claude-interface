import { Router, Request, Response } from 'express';
import { FileHandler } from '../handlers/file-handler.js';
import {
  FileReadRequest,
  FileWriteRequest,
  FileEditRequest,
  FileDeleteRequest,
} from '../types.js';

export function createFileRoutes(fileHandler: FileHandler): Router {
  const router = Router();

  // Read a file
  router.post('/read', async (req: Request, res: Response) => {
    try {
      const request: FileReadRequest = req.body;

      if (!request.path) {
        return res.status(400).json({
          error: 'File path is required',
          code: 'INVALID_REQUEST',
        });
      }

      const content = await fileHandler.readFile(request);
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to read file',
        code: 'FILE_READ_ERROR',
        details: error.message,
      });
    }
  });

  // Write a file
  router.post('/write', async (req: Request, res: Response) => {
    try {
      const request: FileWriteRequest = req.body;

      if (!request.path || request.content === undefined) {
        return res.status(400).json({
          error: 'File path and content are required',
          code: 'INVALID_REQUEST',
        });
      }

      await fileHandler.writeFile(request);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to write file',
        code: 'FILE_WRITE_ERROR',
        details: error.message,
      });
    }
  });

  // Edit a file
  router.post('/edit', async (req: Request, res: Response) => {
    try {
      const request: FileEditRequest = req.body;

      if (!request.path || !request.oldString || request.newString === undefined) {
        return res.status(400).json({
          error: 'File path, oldString, and newString are required',
          code: 'INVALID_REQUEST',
        });
      }

      await fileHandler.editFile(request);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to edit file',
        code: 'FILE_EDIT_ERROR',
        details: error.message,
      });
    }
  });

  // Delete a file
  router.post('/delete', async (req: Request, res: Response) => {
    try {
      const request: FileDeleteRequest = req.body;

      if (!request.path) {
        return res.status(400).json({
          error: 'File path is required',
          code: 'INVALID_REQUEST',
        });
      }

      await fileHandler.deleteFile(request);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to delete file',
        code: 'FILE_DELETE_ERROR',
        details: error.message,
      });
    }
  });

  // List files in a directory
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const dirPath = (req.query.path as string) || '.';
      const files = await fileHandler.listFiles(dirPath);
      res.json({ files });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to list files',
        code: 'FILE_LIST_ERROR',
        details: error.message,
      });
    }
  });

  // Check if file exists
  router.get('/exists', async (req: Request, res: Response) => {
    try {
      const path = req.query.path as string;

      if (!path) {
        return res.status(400).json({
          error: 'File path is required',
          code: 'INVALID_REQUEST',
        });
      }

      const exists = await fileHandler.fileExists(path);
      res.json({ exists });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to check file existence',
        code: 'FILE_EXISTS_ERROR',
        details: error.message,
      });
    }
  });

  // Get file info
  router.get('/info', async (req: Request, res: Response) => {
    try {
      const path = req.query.path as string;

      if (!path) {
        return res.status(400).json({
          error: 'File path is required',
          code: 'INVALID_REQUEST',
        });
      }

      const info = await fileHandler.getFileInfo(path);
      res.json(info);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get file info',
        code: 'FILE_INFO_ERROR',
        details: error.message,
      });
    }
  });

  return router;
}
