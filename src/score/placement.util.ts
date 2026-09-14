import { PLANNING } from '../common/constants';

/**
 * Points a team earns for finishing at `rank` in a completed game — the basis
 * of the session (cross-game) leaderboard.
 *
 * - Winner-bonus games (`GameLibrary.winnerBonusPoints` set) pay a flat bonus
 *   to 1st place only; everyone else scores 0 (e.g. Musical Cups' 5-pt
 *   headstart).
 * - Otherwise, placement points by position: 1st = 3, 2nd = 2, 3rd = 1, then 0
 *   (`PLANNING.DEFAULT_PLACEMENT_POINTS`).
 *
 * Tied teams share a rank (standard competition ranking from
 * `getRankedGameScores`) and each receive that rank's points.
 */
export function placementPoints(
  rank: number,
  winnerBonusPoints: number | null,
): number {
  if (winnerBonusPoints != null) {
    return rank === 1 ? winnerBonusPoints : 0;
  }
  return PLANNING.DEFAULT_PLACEMENT_POINTS[rank - 1] ?? 0;
}
