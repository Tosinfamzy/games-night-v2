import type { DefaultEventsMap, Socket } from 'socket.io';

/** Authenticated user attached to a socket by WsJwtAuthGuard. */
export interface WsAuthUser {
  userId: string;
  email: string;
  role: string;
  profileId?: string;
}

/** Authenticated player attached to a socket by WsPlayerAuthGuard. */
export interface WsPlayerData {
  playerId: string;
  sessionId: string;
  playerName: string;
}

/** Strongly-typed `socket.data` payload used across the app's gateways/guards. */
export interface AppSocketData {
  user?: WsAuthUser;
  player?: WsPlayerData;
}

/** socket.io `Socket` with a typed `data` property. */
export type AppSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  AppSocketData
>;
