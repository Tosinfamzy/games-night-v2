import { INITIAL_GAMES } from './game-library.seed';
import { GameFormat } from './enums/game-format.enum';

const byName = (name: string) => {
  const game = INITIAL_GAMES.find((g) => g.name === name);
  if (!game) {
    throw new Error(`Seed game "${name}" not found`);
  }
  return game;
};

describe('game library seed — planning metadata', () => {
  it('gives every seeded game a valid format and sane player range', () => {
    const validFormats = Object.values(GameFormat);
    for (const game of INITIAL_GAMES) {
      expect(game.name).toBeTruthy();
      expect(validFormats).toContain(game.format);
      expect(game.recommendedRounds ?? 1).toBeGreaterThanOrEqual(1);
      expect(game.minPlayers).toBeLessThanOrEqual(game.maxPlayers);
    }
  });

  it('marks card/free-for-all games as free_for_all', () => {
    for (const name of [
      'UNO',
      'Cards Against Humanity',
      'UNO No Mercy',
      'Musical Cups',
    ]) {
      expect(byName(name).format).toBe(GameFormat.FREE_FOR_ALL);
    }
  });

  it('pays Musical Cups a 5-point winner headstart', () => {
    expect(byName('Musical Cups').winnerBonusPoints).toBe(5);
  });

  it('requires 3 teams for Heavy Drinkers (one drinks, two judge)', () => {
    const heavyDrinkers = byName('Heavy Drinkers');
    expect(heavyDrinkers.minTeams).toBe(3);
    expect(heavyDrinkers.recommendedRounds).toBe(3);
    expect(heavyDrinkers.playersPerRound).toBe(3);
  });

  it('runs Flippy Cup as a round-robin', () => {
    expect(byName('Flippy Cup → Tic-Tac-Toe').format).toBe(
      GameFormat.ROUND_ROBIN,
    );
  });

  it('runs Blind, Deaf & Mute as a trio finale', () => {
    const finale = byName('Blind, Deaf & Mute');
    expect(finale.format).toBe(GameFormat.TRIO);
    expect(finale.playersPerRound).toBe(3);
  });

  it('sets multi-wave games to their run-of-show round counts', () => {
    expect(byName('Head, Shoulders, Knees & Cup').recommendedRounds).toBe(3);
    expect(byName('Head, Shoulders, Knees & Cup').playersPerRound).toBe(6);
    expect(byName('Karaoke — Keep Singing').recommendedRounds).toBe(5);
    expect(byName('Candle Blow').recommendedRounds).toBe(3);
  });

  it('has no duplicate game names', () => {
    const names = INITIAL_GAMES.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
