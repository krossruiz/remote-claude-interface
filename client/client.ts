/**
 * Remote Claude Client SDK
 *
 * A TypeScript/JavaScript client library for interacting with the Remote Claude API
 * Works in browsers, Node.js, React Native, and other JavaScript environments
 */

export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface ChatOptions {
  sessionId?: string;
  stream?: boolean;
  onToken?: (token: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
}

export interface FileReadOptions {
  path: string;
  encoding?: 'utf8' | 'base64';
}

export interface FileWriteOptions {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface FileEditOptions {
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface TerminalExecuteOptions {
  command: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  stream?: boolean;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export class RemoteClaudeClient {
  private config: ClientConfig;
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, any> = new Map();

  constructor(config: ClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Create a new session
   */
  async createSession(metadata?: Record<string, any>): Promise<{ sessionId: string; createdAt: string }> {
    const response = await this.request('POST', '/api/sessions', { metadata });
    return response;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `/api/sessions/${sessionId}`);
  }

  /**
   * List all active sessions
   */
  async listSessions(): Promise<any[]> {
    const response = await this.request('GET', '/api/sessions');
    return response.sessions;
  }

  /**
   * Send a message to Claude
   */
  async chat(message: string, options: ChatOptions = {}): Promise<string> {
    if (options.stream) {
      return await this.chatStreaming(message, options);
    } else {
      const response = await this.request('POST', '/api/chat', {
        sessionId: options.sessionId,
        message,
        stream: false,
      });
      return response.response;
    }
  }

  /**
   * Chat with streaming (Server-Sent Events)
   */
  private async chatStreaming(message: string, options: ChatOptions): Promise<string> {
    const url = `${this.config.baseUrl}/api/chat`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        sessionId: options.sessionId,
        message,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'token') {
              fullResponse += data.content;
              options.onToken?.(data.content);
            } else if (data.type === 'complete') {
              options.onComplete?.(data.content);
              return data.content;
            } else if (data.type === 'error') {
              const error = new Error(data.error);
              options.onError?.(error);
              throw error;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullResponse;
  }

  /**
   * Get conversation history for a session
   */
  async getHistory(sessionId: string): Promise<any[]> {
    const response = await this.request('GET', `/api/chat/history/${sessionId}`);
    return response.history;
  }

  /**
   * Clear conversation history
   */
  async clearHistory(sessionId: string): Promise<void> {
    await this.request('DELETE', `/api/chat/history/${sessionId}`);
  }

  /**
   * Read a file
   */
  async readFile(options: FileReadOptions): Promise<string> {
    const response = await this.request('POST', '/api/files/read', options);
    return response.content;
  }

  /**
   * Write a file
   */
  async writeFile(options: FileWriteOptions): Promise<void> {
    await this.request('POST', '/api/files/write', options);
  }

  /**
   * Edit a file
   */
  async editFile(options: FileEditOptions): Promise<void> {
    await this.request('POST', '/api/files/edit', options);
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    await this.request('POST', '/api/files/delete', { path });
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = '.'): Promise<any[]> {
    const response = await this.request('GET', `/api/files/list?path=${encodeURIComponent(path)}`);
    return response.files;
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    const response = await this.request('GET', `/api/files/exists?path=${encodeURIComponent(path)}`);
    return response.exists;
  }

  /**
   * Get file info
   */
  async getFileInfo(path: string): Promise<any> {
    return await this.request('GET', `/api/files/info?path=${encodeURIComponent(path)}`);
  }

  /**
   * Execute a terminal command
   */
  async executeCommand(options: TerminalExecuteOptions): Promise<any> {
    if (options.stream) {
      return await this.executeCommandStreaming(options);
    } else {
      return await this.request('POST', '/api/terminal/execute', {
        command: options.command,
        cwd: options.cwd,
        timeout: options.timeout,
        env: options.env,
      });
    }
  }

  /**
   * Execute command with streaming
   */
  private async executeCommandStreaming(options: TerminalExecuteOptions): Promise<any> {
    const url = `${this.config.baseUrl}/api/terminal/execute/stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        command: options.command,
        cwd: options.cwd,
        timeout: options.timeout,
        env: options.env,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let result: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'stdout') {
              options.onStdout?.(data.content);
            } else if (data.type === 'stderr') {
              options.onStderr?.(data.content);
            } else if (data.type === 'complete') {
              result = data.result;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return result;
  }

  /**
   * Connect to WebSocket for real-time communication
   */
  connectWebSocket(onMessage?: (data: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.baseUrl.replace('http', 'ws') + `/ws?apiKey=${this.config.apiKey}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Handle message with requestId
        if (data.requestId) {
          const handler = this.messageHandlers.get(data.requestId);
          if (handler) {
            handler(data);
            if (data.type === 'complete' || data.type === 'error') {
              this.messageHandlers.delete(data.requestId);
            }
          }
        }

        // Call general message handler
        onMessage?.(data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.ws = null;
      };
    });
  }

  /**
   * Send a message via WebSocket
   */
  sendWebSocketMessage(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = Math.random().toString(36).substring(7);

      this.messageHandlers.set(requestId, (response: any) => {
        if (response.type === 'error') {
          reject(new Error(response.payload.error));
        } else if (response.type === 'complete') {
          resolve(response.payload);
        }
      });

      this.ws.send(JSON.stringify({
        type,
        payload,
        requestId,
      }));
    });
  }

  /**
   * Chat via WebSocket (with streaming support)
   */
  async chatViaWebSocket(
    message: string,
    sessionId?: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = Math.random().toString(36).substring(7);
      let fullResponse = '';

      this.messageHandlers.set(requestId, (response: any) => {
        if (response.type === 'data') {
          const token = response.payload.token;
          fullResponse += token;
          onToken?.(token);
        } else if (response.type === 'complete') {
          this.messageHandlers.delete(requestId);
          resolve(response.payload.response);
        } else if (response.type === 'error') {
          this.messageHandlers.delete(requestId);
          reject(new Error(response.payload.error));
        }
      });

      this.ws.send(JSON.stringify({
        type: 'chat',
        payload: { message, sessionId },
        requestId,
      }));
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Make an HTTP request to the API
   */
  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-API-Key': this.config.apiKey,
    };

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Export for CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RemoteClaudeClient };
}
