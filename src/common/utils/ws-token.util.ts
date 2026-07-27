/**
 * Extract a player token from a Socket.IO handshake.
 *
 * Shared by the connection-time auth middleware (AuthenticatedIoAdapter) and the
 * message-time WsPlayerAuthGuard so both look in the same places, in the same
 * order: `auth.playerToken` -> `auth.token` -> `query.playerToken`.
 */
export interface WsHandshakeLike {
  auth?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

export function extractPlayerToken(handshake: WsHandshakeLike): string | null {
  const auth = handshake.auth ?? {};

  if (typeof auth.playerToken === 'string') {
    return auth.playerToken;
  }
  // Fallback for backwards compatibility.
  if (typeof auth.token === 'string') {
    return auth.token;
  }

  const queryToken = handshake.query?.playerToken;
  if (typeof queryToken === 'string') {
    return queryToken;
  }

  return null;
}
