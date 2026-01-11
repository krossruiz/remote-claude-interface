import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { config } from '../config.js';
import { TerminalExecuteRequest, TerminalExecuteResponse } from '../types.js';

const execAsync = promisify(exec);

export class TerminalHandler {
  private workspaceRoot: string;
  private maxTimeout: number = 300000; // 5 minutes max

  constructor() {
    this.workspaceRoot = path.resolve(config.claude.workspaceRoot);
  }

  /**
   * Validates working directory is within workspace
   */
  private validateCwd(cwd?: string): string {
    const targetCwd = cwd ? path.resolve(this.workspaceRoot, cwd) : this.workspaceRoot;

    if (!targetCwd.startsWith(this.workspaceRoot)) {
      throw new Error('Working directory must be within workspace');
    }

    return targetCwd;
  }

  /**
   * Basic command validation to prevent obvious attacks
   * Note: This is not foolproof - implement additional security as needed
   */
  private validateCommand(command: string): void {
    // Block commands that are clearly dangerous
    const dangerousPatterns = [
      /rm\s+-rf\s+\/(?!\w)/,  // rm -rf / (but allow /home, /tmp, etc.)
      /:\(\)\{.*\};:/,         // Fork bombs
      /mkfs\./,                // Filesystem formatting
      /dd\s+if=.*of=\/dev/,    // Writing to devices
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error('Command blocked for security reasons');
      }
    }
  }

  async execute(request: TerminalExecuteRequest): Promise<TerminalExecuteResponse> {
    this.validateCommand(request.command);

    const cwd = this.validateCwd(request.cwd);
    const timeout = Math.min(request.timeout || 120000, this.maxTimeout);

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(request.command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: {
          ...process.env,
          ...request.env,
          CLAUDE_CODE_REMOTE: 'true',
        },
      });

      const duration = Date.now() - startTime;

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1,
        duration,
      };
    }
  }

  /**
   * Execute command with streaming output
   * Returns a readable stream for real-time output
   */
  executeStreaming(
    request: TerminalExecuteRequest,
    onStdout: (data: string) => void,
    onStderr: (data: string) => void,
  ): Promise<TerminalExecuteResponse> {
    this.validateCommand(request.command);

    const cwd = this.validateCwd(request.cwd);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn(request.command, [], {
        cwd,
        shell: true,
        env: {
          ...process.env,
          ...request.env,
          CLAUDE_CODE_REMOTE: 'true',
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const str = data.toString();
        stdout += str;
        onStdout(str);
      });

      child.stderr.on('data', (data: Buffer) => {
        const str = data.toString();
        stderr += str;
        onStderr(str);
      });

      child.on('close', (code: number) => {
        const duration = Date.now() - startTime;
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          duration,
        });
      });

      child.on('error', (error: Error) => {
        reject(error);
      });

      // Timeout handling
      const timeout = Math.min(request.timeout || 120000, this.maxTimeout);
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, timeout);
    });
  }
}
