/**
 * Extract a player token from a Socket.IO handshake.
 *
 * Shared by the connection-time auth middleware (AuthenticatedIoAdapter) and the
 * message-time WsPlayerAuthGuard so both look in the same places, in the same
 * order: `auth.playerToken` -> `auth.token`.
 *
 * The token is read only from the handshake `auth` payload, never the query
 * string — query strings are the most log/proxy-leaky place to carry a bearer
 * credential, and the frontend always sends it via `auth.playerToken`.
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

  return null;
}
