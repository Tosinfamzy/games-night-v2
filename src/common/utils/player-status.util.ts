import { PlayerStatus } from '../../player/player.entity';

/**
 * A player still participating in the session — any status except DISCONNECTED
 * (i.e. JOINED, READY, or PLAYING). Use this for session presence, readiness
 * counts, and team (re)assignment eligibility.
 */
export function isActivePlayer(player: { status: PlayerStatus }): boolean {
  return player.status !== PlayerStatus.DISCONNECTED;
}

/**
 * A player who is actively in a started game (status PLAYING). Team *formation*
 * uses this stricter check — players are moved to PLAYING when the session starts.
 */
export function isPlayingPlayer(player: { status: PlayerStatus }): boolean {
  return player.status === PlayerStatus.PLAYING;
}
