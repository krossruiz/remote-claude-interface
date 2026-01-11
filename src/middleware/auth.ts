import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'UNAUTHORIZED',
      details: 'Provide API key via X-API-Key header or apiKey query parameter',
    });
  }

  if (apiKey !== config.security.apiKey) {
    return res.status(403).json({
      error: 'Invalid API key',
      code: 'FORBIDDEN',
    });
  }

  next();
}

// Rate limiting store (in-memory, use Redis for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const identifier = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return next();
  }

  record.count++;

  if (record.count > config.security.maxRequestsPerMinute) {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      details: `Max ${config.security.maxRequestsPerMinute} requests per minute`,
    });
  }

  next();
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);
