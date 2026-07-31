import { GameResponseDto } from './game.response';
import { Game } from '../../game/game.entity';
import { ScoreMode } from '../../game/enums/score-mode.enum';
import { GameStatus } from '../../game/enums/game-status.enum';

// Regression guard: GameResponseDto once dropped scoreMode entirely, so the
// frontend always saw game.scoreMode === undefined and treated every game as
// team-mode — leaving individual scoring unusable from the UI even though the
// backend stored it correctly. Keep the entrant-mode fields in the response.
describe('GameResponseDto.fromEntity', () => {
  const base = (overrides: Partial<Game> = {}): Game =>
    ({
      id: 'game-1',
      name: 'Chess',
      status: GameStatus.PENDING,
      currentRound: 0,
      maxRounds: 1,
      scoreMode: ScoreMode.TEAM,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Game;

  it('includes scoreMode (individual) and currentTurnPlayerId', () => {
    const dto = GameResponseDto.fromEntity(
      base({
        scoreMode: ScoreMode.INDIVIDUAL,
        currentTurnPlayerId: 'player-9',
      }),
    );
    expect(dto.scoreMode).toBe('individual');
    expect(dto.currentTurnPlayerId).toBe('player-9');
  });

  it('defaults to team mode with null turn-player', () => {
    const dto = GameResponseDto.fromEntity(base());
    expect(dto.scoreMode).toBe('team');
    expect(dto.currentTurnPlayerId).toBeNull();
  });
});
