import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config.js';
import {
  FileReadRequest,
  FileWriteRequest,
  FileEditRequest,
  FileDeleteRequest,
} from '../types.js';

export class FileHandler {
  private workspaceRoot: string;

  constructor() {
    this.workspaceRoot = path.resolve(config.claude.workspaceRoot);
  }

  /**
   * Validates that a file path is within the workspace root
   * Prevents path traversal attacks
   */
  private validatePath(filePath: string): string {
    const resolvedPath = path.resolve(this.workspaceRoot, filePath);

    if (!resolvedPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected: Access denied outside workspace');
    }

    return resolvedPath;
  }

  async readFile(request: FileReadRequest): Promise<string> {
    const resolvedPath = this.validatePath(request.path);
    const encoding = request.encoding || 'utf8';

    try {
      const content = await fs.readFile(resolvedPath, encoding);
      return content;
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async writeFile(request: FileWriteRequest): Promise<void> {
    const resolvedPath = this.validatePath(request.path);
    const encoding = request.encoding || 'utf8';

    try {
      // Ensure directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(resolvedPath, request.content, encoding);
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  async editFile(request: FileEditRequest): Promise<void> {
    const resolvedPath = this.validatePath(request.path);

    try {
      const content = await fs.readFile(resolvedPath, 'utf8');

      let newContent: string;
      if (request.replaceAll) {
        newContent = content.replaceAll(request.oldString, request.newString);
      } else {
        // Replace only first occurrence
        const index = content.indexOf(request.oldString);
        if (index === -1) {
          throw new Error('Old string not found in file');
        }
        newContent =
          content.slice(0, index) +
          request.newString +
          content.slice(index + request.oldString.length);
      }

      await fs.writeFile(resolvedPath, newContent, 'utf8');
    } catch (error: any) {
      throw new Error(`Failed to edit file: ${error.message}`);
    }
  }

  async deleteFile(request: FileDeleteRequest): Promise<void> {
    const resolvedPath = this.validatePath(request.path);

    try {
      await fs.unlink(resolvedPath);
    } catch (error: any) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async listFiles(dirPath: string = '.'): Promise<string[]> {
    const resolvedPath = this.validatePath(dirPath);

    try {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name),
      })) as any;
    } catch (error: any) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    const resolvedPath = this.validatePath(filePath);

    try {
      await fs.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(filePath: string): Promise<any> {
    const resolvedPath = this.validatePath(filePath);

    try {
      const stats = await fs.stat(resolvedPath);
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch (error: any) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }
}
