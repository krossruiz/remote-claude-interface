import { v4 as uuidv4 } from 'uuid';
import { Session } from './types.js';
import { config } from './config.js';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);
  }

  createSession(metadata?: Record<string, any>): Session {
    const session: Session = {
      id: uuidv4(),
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata,
    };

    this.sessions.set(session.id, session);
    console.log(`Session created: ${session.id}`);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`Session deleted: ${sessionId}`);
    }
    return deleted;
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const timeout = config.session.timeoutMs;
    let cleanedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActivity.getTime();
      if (inactiveTime > timeout) {
        this.sessions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}
