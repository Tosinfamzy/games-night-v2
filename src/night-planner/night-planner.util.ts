import { LIMITS, PLANNING } from '../common/constants';
import { GameFormat } from '../game-library/enums/game-format.enum';

/**
 * Pure, side-effect-free planning helpers for the Night Builder. Kept apart
 * from the service so the maths (splits, timing, team counts, scoring labels)
 * can be unit-tested without a database.
 */

/**
 * Split `total` players across `groups` teams as evenly as possible — sizes
 * differ by at most one, with the larger teams first. e.g. (20, 3) → [7, 7, 6].
 */
export function splitEvenly(total: number, groups: number): number[] {
  if (groups <= 0 || total < 0) return [];
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from({ length: groups }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
}

/**
 * Suggest a team count for the night: prefer 3, but never fewer than any
 * selected game demands, never below the global minimum, and never more than
 * the cap or the headcount can support.
 */
export function suggestTeamCount(
  playerCount: number,
  minTeamsRequired: number,
  preferred: number = PLANNING.DEFAULT_TEAM_COUNT,
): number {
  const floor = Math.max(LIMITS.MIN_TEAMS_PER_GAME, minTeamsRequired);
  // Ceiling respects the hard cap and the headcount, but can never drop below
  // the floor (if there aren't enough players, that surfaces as a warning).
  const ceiling = Math.max(
    floor,
    Math.min(LIMITS.MAX_TEAMS_PER_GAME, Math.max(playerCount, 1)),
  );
  return Math.min(Math.max(preferred, floor), ceiling);
}

/**
 * Minutes a game segment takes for a given round count. Scales the library's
 * estimate proportionally from its recommended rounds, so tuning rounds up or
 * down moves the timeline sensibly. Falls back when no estimate exists.
 */
export function segmentMinutes(
  estimatedDuration: number | null | undefined,
  rounds: number,
  recommendedRounds: number,
): number {
  const base = estimatedDuration ?? PLANNING.FALLBACK_GAME_MINUTES;
  if (!recommendedRounds || recommendedRounds < 1) return base;
  return Math.max(1, Math.round(base * (rounds / recommendedRounds)));
}

export interface TimelineInput {
  gameLibraryId: string;
  name: string;
  minutes: number;
}

export interface TimelineItem extends TimelineInput {
  startOffsetMinutes: number;
}

export interface Timeline {
  items: TimelineItem[];
  totalMinutes: number;
}

/** Lay games end-to-end into a run-of-show timeline with cumulative offsets. */
export function buildTimeline(segments: TimelineInput[]): Timeline {
  let offset = 0;
  const items = segments.map((segment) => {
    const item: TimelineItem = { ...segment, startOffsetMinutes: offset };
    offset += segment.minutes;
    return item;
  });
  return { items, totalMinutes: offset };
}

/** Human-readable scoring rule for a game (winner bonus overrides placement). */
export function scoringLabel(winnerBonusPoints: number | null): string {
  if (winnerBonusPoints != null) {
    return `Winner scores ${winnerBonusPoints} pts`;
  }
  const [first, second, third] = PLANNING.DEFAULT_PLACEMENT_POINTS;
  return `Placement — 1st ${first}, 2nd ${second}, 3rd ${third}`;
}

/** How a game format reads in the run-of-show. */
export function formatLabel(format: GameFormat): string {
  switch (format) {
    case GameFormat.FREE_FOR_ALL:
      return 'Everyone plays';
    case GameFormat.ROUND_ROBIN:
      return '2 teams, round-robin';
    case GameFormat.TRIO:
      return 'Trios (one per team)';
    case GameFormat.ALL_TEAMS:
    default:
      return 'All teams at once';
  }
}
