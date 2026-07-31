import { PlayerStatus } from '../../player/player.entity';

/**
 * A player still participating in the session — any status except DISCONNECTED
 * (i.e. JOINED, READY, or PLAYING). Use this for session presence, readiness
 * counts, and team (re)assignment eligibility.
 */
export function isActivePlayer(player: { status: PlayerStatus }): boolean {
  return player.status !== PlayerStatus.DISCONNECTED;
}
