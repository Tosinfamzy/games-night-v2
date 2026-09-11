import {
  buildTimeline,
  formatLabel,
  scoringLabel,
  segmentMinutes,
  splitEvenly,
  suggestTeamCount,
} from './night-planner.util';
import { GameFormat } from '../game-library/enums/game-format.enum';

describe('splitEvenly', () => {
  it('splits evenly when divisible', () => {
    expect(splitEvenly(24, 3)).toEqual([8, 8, 8]);
    expect(splitEvenly(12, 3)).toEqual([4, 4, 4]);
  });

  it('keeps sizes within one, larger teams first', () => {
    expect(splitEvenly(20, 3)).toEqual([7, 7, 6]);
    expect(splitEvenly(14, 3)).toEqual([5, 5, 4]);
  });

  it('handles more teams than players', () => {
    expect(splitEvenly(2, 3)).toEqual([1, 1, 0]);
  });

  it('guards degenerate inputs', () => {
    expect(splitEvenly(10, 0)).toEqual([]);
    expect(splitEvenly(-1, 3)).toEqual([]);
    expect(splitEvenly(0, 3)).toEqual([0, 0, 0]);
  });
});

describe('suggestTeamCount', () => {
  it('prefers 3 for a typical party headcount', () => {
    expect(suggestTeamCount(20, 0)).toBe(3);
    expect(suggestTeamCount(24, 0)).toBe(3);
  });

  it('never drops below a game-required minimum', () => {
    expect(suggestTeamCount(20, 4)).toBe(4);
  });

  it('never exceeds the cap or headcount', () => {
    expect(suggestTeamCount(2, 0)).toBe(2); // MIN_TEAMS_PER_GAME
    expect(suggestTeamCount(100, 0)).toBe(3); // preferred still wins
  });

  it('holds the required floor even when short on players (warned elsewhere)', () => {
    expect(suggestTeamCount(2, 3)).toBe(3);
  });
});

describe('segmentMinutes', () => {
  it('equals the estimate at the recommended round count', () => {
    expect(segmentMinutes(15, 3, 3)).toBe(15);
  });

  it('scales proportionally when rounds are tuned', () => {
    expect(segmentMinutes(15, 6, 3)).toBe(30);
    expect(segmentMinutes(15, 1, 3)).toBe(5);
  });

  it('falls back when no estimate exists', () => {
    expect(segmentMinutes(null, 1, 1)).toBe(10);
    expect(segmentMinutes(undefined, 2, 0)).toBe(10);
  });

  it('never returns less than a minute', () => {
    expect(segmentMinutes(1, 1, 10)).toBe(1);
  });
});

describe('buildTimeline', () => {
  it('lays segments end-to-end with cumulative offsets', () => {
    const timeline = buildTimeline([
      { gameLibraryId: 'a', name: 'A', minutes: 10 },
      { gameLibraryId: 'b', name: 'B', minutes: 20 },
      { gameLibraryId: 'c', name: 'C', minutes: 15 },
    ]);
    expect(timeline.items.map((i) => i.startOffsetMinutes)).toEqual([
      0, 10, 30,
    ]);
    expect(timeline.totalMinutes).toBe(45);
  });

  it('handles an empty line-up', () => {
    expect(buildTimeline([])).toEqual({ items: [], totalMinutes: 0 });
  });
});

describe('scoringLabel', () => {
  it('reports a flat winner bonus when set', () => {
    expect(scoringLabel(5)).toBe('Winner scores 5 pts');
  });

  it('falls back to placement points', () => {
    expect(scoringLabel(null)).toBe('Placement — 1st 3, 2nd 2, 3rd 1');
  });
});

describe('formatLabel', () => {
  it('maps every format to a human label', () => {
    expect(formatLabel(GameFormat.FREE_FOR_ALL)).toBe('Everyone plays');
    expect(formatLabel(GameFormat.ROUND_ROBIN)).toBe('2 teams, round-robin');
    expect(formatLabel(GameFormat.TRIO)).toBe('Trios (one per team)');
    expect(formatLabel(GameFormat.ALL_TEAMS)).toBe('All teams at once');
  });
});
