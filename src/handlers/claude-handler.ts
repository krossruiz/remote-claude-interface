import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { FileHandler } from './file-handler.js';
import { TerminalHandler } from './terminal-handler.js';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeStreamCallback {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export class ClaudeHandler {
  private client: Anthropic;
  private fileHandler: FileHandler;
  private terminalHandler: TerminalHandler;
  private conversationHistory: Map<string, ClaudeMessage[]> = new Map();

  constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.anthropicApiKey,
    });
    this.fileHandler = new FileHandler();
    this.terminalHandler = new TerminalHandler();
  }

  /**
   * Send a message to Claude and get a response
   */
  async chat(
    sessionId: string,
    message: string,
    stream: boolean = false,
    streamCallback?: ClaudeStreamCallback,
  ): Promise<string> {
    // Get or initialize conversation history
    let history = this.conversationHistory.get(sessionId) || [];

    // Add user message to history
    history.push({
      role: 'user',
      content: message,
    });

    try {
      if (stream && streamCallback) {
        return await this.chatWithStreaming(sessionId, history, streamCallback);
      } else {
        return await this.chatWithoutStreaming(sessionId, history);
      }
    } catch (error: any) {
      if (streamCallback) {
        streamCallback.onError(error);
      }
      throw error;
    }
  }

  private async chatWithoutStreaming(
    sessionId: string,
    history: ClaudeMessage[],
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: history as any,
      system: this.getSystemPrompt(),
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: assistantMessage,
    });

    this.conversationHistory.set(sessionId, history);

    return assistantMessage;
  }

  private async chatWithStreaming(
    sessionId: string,
    history: ClaudeMessage[],
    callback: ClaudeStreamCallback,
  ): Promise<string> {
    let fullResponse = '';

    const stream = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: history as any,
      system: this.getSystemPrompt(),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const token = event.delta.text;
          fullResponse += token;
          callback.onToken(token);
        }
      }
    }

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: fullResponse,
    });

    this.conversationHistory.set(sessionId, history);
    callback.onComplete(fullResponse);

    return fullResponse;
  }

  /**
   * Clear conversation history for a session
   */
  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId: string): ClaudeMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Get system prompt that gives Claude context about the remote environment
   */
  private getSystemPrompt(): string {
    return `You are Claude Code, running in a remote mode via an API interface.

You are connected to a desktop environment and can interact with the filesystem and execute terminal commands.

Workspace Root: ${config.claude.workspaceRoot}

You have access to the following capabilities:
- Read, write, edit, and delete files within the workspace
- Execute terminal commands
- Access the full filesystem within the workspace directory

When users ask you to perform file operations or run commands, you should describe what you would do.
The API will handle the actual execution of file operations and terminal commands based on your responses.

Be helpful, accurate, and security-conscious. Always validate paths and commands before suggesting operations.`;
  }

  /**
   * Execute a file operation based on Claude's suggestion
   */
  async executeFileOperation(operation: any): Promise<any> {
    switch (operation.type) {
      case 'read':
        return await this.fileHandler.readFile(operation);
      case 'write':
        return await this.fileHandler.writeFile(operation);
      case 'edit':
        return await this.fileHandler.editFile(operation);
      case 'delete':
        return await this.fileHandler.deleteFile(operation);
      default:
        throw new Error(`Unknown file operation: ${operation.type}`);
    }
  }

  /**
   * Execute a terminal command
   */
  async executeTerminalCommand(request: any): Promise<any> {
    return await this.terminalHandler.execute(request);
  }
}
