/**
 * Single source of truth for allowed browser origins, shared by the HTTP CORS
 * policy (main.ts `enableCors`) and the WebSocket gateways (`WS_CORS_CONFIG`).
 *
 * Previously the WS list was a separate, narrower array that omitted the prod
 * `*.vercel.app` origin — so authenticated WS handshakes would still fail CORS
 * in production. Both layers now use `isAllowedOrigin`.
 */

// localhost / LAN origins — only honoured outside production.
const DEV_ORIGIN_PATTERNS: RegExp[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
];

// The frontend's hosting domain — allowed in every environment.
const ALWAYS_ORIGIN_PATTERNS: RegExp[] = [/^https:\/\/.*\.vercel\.app$/];

/**
 * Whether a request/handshake `Origin` is allowed. A missing Origin (server-to-
 * server calls, health checks, native socket clients) is allowed. `FRONTEND_URL`
 * is read at call time so env changes are honored without a rebuild. The
 * localhost/LAN patterns are disabled in production so a prod deployment only
 * accepts its real frontend origin(s).
 */
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && origin === frontendUrl) {
    return true;
  }
  if (ALWAYS_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    return true;
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    DEV_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
  ) {
    return true;
  }
  return false;
}

/**
 * CORS config applied to every WebSocket gateway. Uses the shared allowlist so
 * the prod origin is honored for socket.io handshakes.
 */
export const WS_CORS_CONFIG = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
};
