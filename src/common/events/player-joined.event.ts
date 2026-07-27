/**
 * Emitted when a player joins a session by join code. The invite module listens
 * for this to link a matching guest-list invite to the player who showed up
 * (the "who actually turned up" bridge), keeping the modules decoupled.
 */
export const PLAYER_JOINED_EVENT = 'player.joined';

export interface PlayerJoinedEvent {
  sessionId: string;
  playerId: string;
  playerName: string;
}
