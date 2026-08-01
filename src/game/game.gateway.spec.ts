import { GameGateway } from './game.gateway';
import { Game } from './game.entity';
import { Repository } from 'typeorm';
import { AppSocket } from '../common/types/socket.types';

/**
 * The game room must be session-scoped (a player can't spectate another
 * session's live game), and the broadcast payloads must carry the field names
 * the frontend actually reads.
 */
describe('GameGateway', () => {
  let gateway: GameGateway;
  let gameRepo: { findOne: jest.Mock };
  let emitToRoom: jest.SpyInstance;

  const client = (sessionId: string): AppSocket =>
    ({
      id: 'sock-1',
      data: { player: { playerId: 'p1', sessionId, playerName: 'P' } },
    }) as unknown as AppSocket;

  beforeEach(() => {
    gameRepo = { findOne: jest.fn() };
    gateway = new GameGateway(gameRepo as unknown as Repository<Game>);
    emitToRoom = jest
      .spyOn(gateway as unknown as { emitToRoom: () => void }, 'emitToRoom')
      .mockImplementation(() => undefined);
    jest
      .spyOn(gateway as unknown as { joinRoom: () => void }, 'joinRoom')
      .mockImplementation(() => undefined);
  });

  describe('join-game session scoping', () => {
    it('rejects a game that belongs to another session', async () => {
      gameRepo.findOne.mockResolvedValue({
        id: 'g1',
        session: { id: 'session-B' },
      });
      const res = await gateway.handleJoinGame('g1', client('session-A'));
      expect(res.status).toBe('error');
    });

    it('joins a game in the caller’s own session', async () => {
      gameRepo.findOne.mockResolvedValue({
        id: 'g1',
        session: { id: 'session-A' },
      });
      const res = await gateway.handleJoinGame('g1', client('session-A'));
      expect(res.status).toBe('joined');
    });

    it('rejects an unknown game', async () => {
      gameRepo.findOne.mockResolvedValue(null);
      const res = await gateway.handleJoinGame('g1', client('session-A'));
      expect(res.status).toBe('error');
    });
  });

  describe('broadcast payload contracts', () => {
    it('score-submitted forwards points + roundNumber (not an undefined score)', () => {
      gateway.handleScoreSubmitted({
        gameId: 'g1',
        teamId: 't1',
        points: 7,
        roundNumber: 2,
      });
      expect(emitToRoom).toHaveBeenCalledWith(
        'game:g1',
        'game:score-submitted',
        expect.objectContaining({ points: 7, roundNumber: 2 }),
      );
    });

    it('score-updated broadcasts on an edit/delete so live boards refresh', () => {
      gateway.handleScoreUpdated({
        gameId: 'g1',
        teamId: 't1',
        entrantType: 'team',
        entrantId: 't1',
        points: 20,
        roundNumber: 2,
      });
      expect(emitToRoom).toHaveBeenCalledWith(
        'game:g1',
        'game:score-updated',
        expect.objectContaining({ teamId: 't1', points: 20, roundNumber: 2 }),
      );
    });

    it('timer-tick includes timeRemaining (the field the FE reads)', () => {
      gateway.broadcastTimerTick('g1', 30, false);
      expect(emitToRoom).toHaveBeenCalledWith(
        'game:g1',
        'game:timer-tick',
        expect.objectContaining({ timeRemaining: 30 }),
      );
    });

    it('turn-advanced includes nextTeamName + autoAdvanced', () => {
      gateway.broadcastTurnAdvanced('g1', 't0', 't1', 'Reds', false);
      expect(emitToRoom).toHaveBeenCalledWith(
        'game:g1',
        'game:turn-advanced',
        expect.objectContaining({ nextTeamName: 'Reds', autoAdvanced: false }),
      );
    });

    it('cancelled broadcasts game:cancelled', () => {
      gateway.broadcastGameCancelled('g1');
      expect(emitToRoom).toHaveBeenCalledWith(
        'game:g1',
        'game:cancelled',
        expect.objectContaining({ gameId: 'g1' }),
      );
    });
  });
});
