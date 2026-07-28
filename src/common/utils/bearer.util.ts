import { Request } from 'express';

/**
 * Extract a Bearer token from an Express request's Authorization header.
 * Returns null when absent or malformed. Shared by the host/Clerk guards so
 * they agree on exactly one extraction rule.
 */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  return null;
}
