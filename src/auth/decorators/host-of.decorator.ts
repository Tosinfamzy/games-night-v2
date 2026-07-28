import { SetMetadata } from '@nestjs/common';

/**
 * How the HostGuard should resolve the target session for a route:
 * - 'session': the route param IS the session id
 * - 'game':    the route param is a game id -> resolve its session
 * - 'score':   the route param is a score id -> resolve its game's session
 */
export type HostResource = 'session' | 'game' | 'score';

export interface HostOfMeta {
  from: HostResource;
  param: string;
}

export const HOST_OF_KEY = 'hostOf';

/**
 * Marks a route as host-only. The HostGuard resolves the target session from
 * the given route param and requires the caller's player token to belong to
 * that session's host.
 */
export const HostOf = (from: HostResource, param = 'id') =>
  SetMetadata(HOST_OF_KEY, { from, param } satisfies HostOfMeta);
