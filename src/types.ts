export interface Session {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  sessionId?: string;
  message: string;
  stream?: boolean;
  context?: string[];
}

export interface ChatResponse {
  sessionId: string;
  response: string;
  completed: boolean;
}

export interface FileOperation {
  path: string;
  content?: string;
  encoding?: 'utf8' | 'base64';
}

export interface FileReadRequest {
  path: string;
  encoding?: 'utf8' | 'base64';
}

export interface FileWriteRequest {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface FileEditRequest {
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface FileDeleteRequest {
  path: string;
}

export interface TerminalExecuteRequest {
  command: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface TerminalExecuteResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface ApiError {
  error: string;
  code: string;
  details?: any;
}

export interface WebSocketMessage {
  type: 'chat' | 'file' | 'terminal' | 'control';
  payload: any;
  requestId?: string;
}

export interface WebSocketResponse {
  type: 'data' | 'error' | 'complete';
  requestId?: string;
  payload: any;
}
