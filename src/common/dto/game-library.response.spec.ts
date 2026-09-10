import { GameLibraryResponseDto } from './game-library.response';
import { GameLibrary } from '../../game-library/game-library.entity';
import { GameFormat } from '../../game-library/enums/game-format.enum';

const makeEntity = (overrides: Partial<GameLibrary> = {}): GameLibrary =>
  Object.assign(new GameLibrary(), {
    id: 'lib-1',
    name: 'Heavy Drinkers',
    description: 'desc',
    minPlayers: 6,
    maxPlayers: 30,
    estimatedDuration: 15,
    difficulty: 'Easy',
    categories: ['Party Game'],
    equipment: '3 cups',
    rules: 'rules',
    isActive: true,
    format: GameFormat.ALL_TEAMS,
    recommendedRounds: 3,
    playersPerRound: 3,
    minTeams: 3,
    winnerBonusPoints: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('GameLibraryResponseDto.fromEntity — planning metadata', () => {
  it('maps all planning fields through', () => {
    const dto = GameLibraryResponseDto.fromEntity(makeEntity());
    expect(dto.format).toBe(GameFormat.ALL_TEAMS);
    expect(dto.recommendedRounds).toBe(3);
    expect(dto.playersPerRound).toBe(3);
    expect(dto.minTeams).toBe(3);
    expect(dto.winnerBonusPoints).toBeNull();
  });

  it('normalises undefined nullable planning fields to null', () => {
    const dto = GameLibraryResponseDto.fromEntity(
      makeEntity({
        playersPerRound: undefined,
        minTeams: undefined,
        winnerBonusPoints: undefined,
      }),
    );
    expect(dto.playersPerRound).toBeNull();
    expect(dto.minTeams).toBeNull();
    expect(dto.winnerBonusPoints).toBeNull();
  });

  it('carries a winner bonus when set', () => {
    const dto = GameLibraryResponseDto.fromEntity(
      makeEntity({
        name: 'Musical Cups',
        format: GameFormat.FREE_FOR_ALL,
        winnerBonusPoints: 5,
      }),
    );
    expect(dto.format).toBe(GameFormat.FREE_FOR_ALL);
    expect(dto.winnerBonusPoints).toBe(5);
  });
});
