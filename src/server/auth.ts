/**
 * auth.ts — Authentication (Google OAuth + JWT)
 * ===============================================
 * Handles Google token verification → JWT issuance.
 * Also provides a demo login for development.
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getDb, generateId } from './db.js';
import { logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

// ─── Types ───

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ─── JWT Helpers ───

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, isPremium: user.isPremium },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

// ─── Google OAuth Login / Register ───

export function loginOrRegister(
  email: string,
  name: string,
  avatar: string = '',
): { user: AuthUser; token: string; isNew: boolean } {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | { id: string; email: string; name: string; is_premium: number }
    | undefined;

  if (existing) {
    const user: AuthUser = {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      isPremium: existing.is_premium === 1,
    };
    return { user, token: signToken(user), isNew: false };
  }

  // New user — register with 1000 gold
  const id = generateId();
  db.prepare(
    'INSERT INTO users (id, email, name, avatar, gold_balance) VALUES (?, ?, ?, ?, 1000)',
  ).run(id, email, name, avatar);

  // Initialize usage tracking
  db.prepare('INSERT INTO usage_tracking (user_id) VALUES (?)').run(id);

  const user: AuthUser = { id, email, name, isPremium: false };
  logger.info({ email }, 'New user registered');
  return { user, token: signToken(user), isNew: true };
}

// ─── Demo Login (Development) ───

export function demoLogin(
  name: string = 'Demo User',
): { user: AuthUser; token: string } {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@demo.agora`;
  const result = loginOrRegister(email, name);
  return { user: result.user, token: result.token };
}

// ─── Auth Middleware ───

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '인증이 필요합니다. Authorization 헤더를 확인해주세요.' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다. 다시 로그인해주세요.' });
  }
}

// ─── Optional Auth (for public endpoints that want user context) ───

export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(authHeader.slice(7));
    } catch {
      // Silently ignore invalid tokens for optional auth
    }
  }
  next();
}
