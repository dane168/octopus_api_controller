import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { findById, User } from '../repositories/users.js';
import { logger } from '../utils/logger.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '7d',
  });
}

/**
 * Verify JWT token and return payload
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware - requires valid JWT
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await findById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.userId = user.id;
  next();
}

/**
 * Optional auth middleware - attaches user if token is valid, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload) {
      const user = await findById(payload.userId);
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
  }

  next();
}
