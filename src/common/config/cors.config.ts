/**
 * Shared CORS config for the WebSocket gateways. Kept in one place so an allowed
 * origin only needs to change once instead of in every gateway.
 *
 * Note: the HTTP CORS policy in main.ts is intentionally separate (it allows a
 * broader set of origins, e.g. *.vercel.app and FRONTEND_URL).
 */
export const WS_CORS_CONFIG = {
  origin: [
    'http://localhost:5173',
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
    /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  ],
  credentials: true,
};
