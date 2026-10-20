import type { Role } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; email?: string | null };
      sessionId?: string;
    }
  }
}

export {};
