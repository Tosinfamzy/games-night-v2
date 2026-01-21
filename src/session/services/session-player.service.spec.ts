import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionPlayerService } from './session-player.service';
import { SessionReadinessService } from './session-readiness.service';
import { Session } from '../session.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { Team } from '../../team/team.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { SessionGateway } from '../session.gateway';
import { AuthService } from '../../auth/auth.service';
import { createMockRepository } from '../../../test/utils/test-db';
import {
  createMockSession,
  createMockPlayer,
  createMockTeam,
  createMockGamesMaster,
  resetTestCounters,
  MockSessionGateway,
  MockAuthService,
  MockSessionReadinessService,
  createMockSessionGateway,
  createMockAuthService,
  createMockSessionReadinessService,
} from '../../../test/utils/test-helpers';
import { GamesMaster } from '../../games-master/games-master.entity';

describe('SessionPlayerService', () => {
  let service: SessionPlayerService;
  let sessionRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let sessionGateway: MockSessionGateway;
  let authService: MockAuthService;
  let readinessService: MockSessionReadinessService;

  beforeEach(async () => {
    sessionRepo = createMockRepository<Session>();
    playerRepo = createMockRepository<Player>();
    teamRepo = createMockRepository<Team>();
    sessionGateway = createMockSessionGateway();
    authService = createMockAuthService();
    readinessService = createMockSessionReadinessService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionPlayerService,
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: getRepositoryToken(Team),
          useValue: teamRepo,
        },
        {
          provide: SessionGateway,
          useValue: sessionGateway,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: SessionReadinessService,
          useValue: readinessService,
        },
      ],
    }).compile();

    service = module.get<SessionPlayerService>(SessionPlayerService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('joinSession', () => {
    it('should allow player to join with unique name', async () => {
      const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
      const session = createMockSession({
        id: 'session-1',
        joinCode: '123456',
        status: SessionStatus.SCHEDULED,
        host: gamesMaster as GamesMaster,
      });
      const mockPlayer = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        session: session as Session,
        status: PlayerStatus.JOINED,
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(null); // Name is unique
      playerRepo.create.mockReturnValue(mockPlayer);
      playerRepo.save.mockResolvedValue(mockPlayer);
      authService.generatePlayerToken.mockReturnValue('mock-token');

      const result = await service.joinSession({
        joinCode: '123456',
        playerName: 'Alice',
      });

      expect(result.player.name).toBe('Alice');
      expect(result.player.status).toBe(PlayerStatus.JOINED);
      expect(result.playerToken).toBe('mock-token');
      expect(sessionGateway.broadcastPlayerJoined).toHaveBeenCalledWith(
        'session-1',
        mockPlayer,
      );
    });

    it('should mark player as guest if no userId provided', async () => {
      const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
      const session = createMockSession({
        joinCode: '123456',
        status: SessionStatus.SCHEDULED,
        host: gamesMaster as GamesMaster,
      });
      const mockPlayer = createMockPlayer({
        name: 'Guest Player',
        isGuest: true,
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(null);
      playerRepo.create.mockReturnValue(mockPlayer);
      playerRepo.save.mockResolvedValue(mockPlayer);
      authService.generatePlayerToken.mockReturnValue('mock-token');

      const result = await service.joinSession({
        joinCode: '123456',
        playerName: 'Guest Player',
      });

      expect(result.player.isGuest).toBe(true);
      expect(playerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isGuest: true }),
      );
    });

    it('should link player to userId if authenticated', async () => {
      const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
      const session = createMockSession({
        joinCode: '123456',
        status: SessionStatus.SCHEDULED,
        host: gamesMaster as GamesMaster,
      });
      const mockPlayer = createMockPlayer({
        name: 'Auth Player',
        userId: 'user-123',
        isGuest: false,
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(null);
      playerRepo.create.mockReturnValue(mockPlayer);
      playerRepo.save.mockResolvedValue(mockPlayer);
      authService.generatePlayerToken.mockReturnValue('mock-token');

      const result = await service.joinSession(
        {
          joinCode: '123456',
          playerName: 'Auth Player',
        },
        'user-123',
      );

      expect(result.player.userId).toBe('user-123');
      expect(result.player.isGuest).toBe(false);
      expect(playerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', isGuest: false }),
      );
    });

    it('should allow rejoining if player name already exists', async () => {
      const gamesMaster = createMockGamesMaster({ name: 'Test GM' });
      const session = createMockSession({
        id: 'session-1',
        joinCode: '123456',
        status: SessionStatus.SCHEDULED,
        host: gamesMaster as GamesMaster,
      });
      const existingPlayer = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        session: session as Session,
        status: PlayerStatus.DISCONNECTED,
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(existingPlayer);
      playerRepo.save.mockResolvedValue({
        ...existingPlayer,
        status: PlayerStatus.JOINED,
        lastConnectedAt: new Date(),
      });
      authService.generatePlayerToken.mockReturnValue('mock-token');

      const result = await service.joinSession({
        joinCode: '123456',
        playerName: 'Alice',
      });

      expect(result.player.id).toBe('player-1');
      expect(result.player.status).toBe(PlayerStatus.JOINED);
      expect(playerRepo.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if session is completed', async () => {
      const session = createMockSession({
        joinCode: '123456',
        status: SessionStatus.COMPLETED,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(
        service.joinSession({
          joinCode: '123456',
          playerName: 'Bob',
        }),
      ).rejects.toThrow('Cannot join a completed session');
    });

    it('should throw BadRequestException if session is cancelled', async () => {
      const session = createMockSession({
        joinCode: '123456',
        status: SessionStatus.CANCELLED,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(
        service.joinSession({
          joinCode: '123456',
          playerName: 'Charlie',
        }),
      ).rejects.toThrow('Cannot join a cancelled session');
    });

    it('should throw BadRequestException if session is in progress', async () => {
      const session = createMockSession({
        joinCode: '123456',
        status: SessionStatus.IN_PROGRESS,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(
        service.joinSession({
          joinCode: '123456',
          playerName: 'David',
        }),
      ).rejects.toThrow('Cannot join session');
    });

    it('should throw NotFoundException if join code invalid', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.joinSession({
          joinCode: '999999',
          playerName: 'Eve',
        }),
      ).rejects.toThrow('Session with join code 999999 not found');
    });
  });

  describe('rejoinSession', () => {
    it('should rejoin session with valid token', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
      });
      const player = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        session: session as Session,
      });

      authService.validatePlayerToken.mockReturnValue({
        playerId: 'player-1',
        sessionId: 'session-1',
        playerName: 'Alice',
      });
      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockResolvedValue({
        ...player,
        status: PlayerStatus.JOINED,
        lastConnectedAt: new Date(),
      });
      sessionRepo.findOne.mockResolvedValue(session);
      authService.generatePlayerToken.mockReturnValue('new-mock-token');

      const result = await service.rejoinSession('old-player-token');

      expect(result.player.id).toBe('player-1');
      expect(result.message).toContain('Welcome back');
      expect(result.playerToken).toBe('new-mock-token');
    });

    it('should throw BadRequestException if token is invalid', async () => {
      authService.validatePlayerToken.mockReturnValue(null);

      await expect(service.rejoinSession('invalid-token')).rejects.toThrow(
        'Invalid or expired player token',
      );
    });

    it('should throw NotFoundException if player not found', async () => {
      authService.validatePlayerToken.mockReturnValue({
        playerId: 'player-1',
        sessionId: 'session-1',
        playerName: 'Alice',
      });
      playerRepo.findOne.mockResolvedValue(null);

      await expect(service.rejoinSession('valid-token')).rejects.toThrow(
        'Player not found',
      );
    });

    it('should throw BadRequestException if token session mismatch', async () => {
      const session = createMockSession({
        id: 'session-2', // Different session
        status: SessionStatus.SCHEDULED,
      });
      const player = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        session: session as Session,
      });

      authService.validatePlayerToken.mockReturnValue({
        playerId: 'player-1',
        sessionId: 'session-1', // Token points to different session
        playerName: 'Alice',
      });
      playerRepo.findOne.mockResolvedValue(player);

      await expect(service.rejoinSession('valid-token')).rejects.toThrow(
        'Token session mismatch',
      );
    });
  });

  describe('setPlayerReady', () => {
    it('should set player to ready status', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
      });
      const player = createMockPlayer({
        id: 'player-1',
        status: PlayerStatus.JOINED,
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockResolvedValue({
        ...player,
        status: PlayerStatus.READY,
      });
      readinessService.canStartSession.mockResolvedValue({
        canStart: false,
        reasons: [],
        checks: {
          hasGames: true,
          playersReady: false,
          playerCountValid: true,
          sessionScheduled: true,
        },
      });

      const result = await service.setPlayerReady('session-1', 'player-1', true);

      expect(result.status).toBe(PlayerStatus.READY);
      expect(sessionGateway.broadcastPlayerReadiness).toHaveBeenCalledWith(
        'session-1',
        'player-1',
        true,
      );
      expect(sessionGateway.broadcastSessionReadiness).toHaveBeenCalled();
    });

    it('should set player to joined status when ready is false', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
      });
      const player = createMockPlayer({
        id: 'player-1',
        status: PlayerStatus.READY,
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockResolvedValue({
        ...player,
        status: PlayerStatus.JOINED,
      });
      readinessService.canStartSession.mockResolvedValue({
        canStart: false,
        reasons: [],
        checks: {
          hasGames: true,
          playersReady: false,
          playerCountValid: true,
          sessionScheduled: true,
        },
      });

      const result = await service.setPlayerReady(
        'session-1',
        'player-1',
        false,
      );

      expect(result.status).toBe(PlayerStatus.JOINED);
      expect(sessionGateway.broadcastPlayerReadiness).toHaveBeenCalledWith(
        'session-1',
        'player-1',
        false,
      );
    });

    it('should throw NotFoundException if player not found', async () => {
      playerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.setPlayerReady('session-1', 'player-1', true),
      ).rejects.toThrow(
        'Player with ID player-1 not found in session session-1',
      );
    });

    it('should throw BadRequestException if session not scheduled', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.IN_PROGRESS,
      });
      const player = createMockPlayer({
        id: 'player-1',
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);

      await expect(
        service.setPlayerReady('session-1', 'player-1', true),
      ).rejects.toThrow('Cannot change player status when session is');
    });
  });

  describe('updatePlayerStatus', () => {
    it('should update player status', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.IN_PROGRESS,
      });
      const player = createMockPlayer({
        id: 'player-1',
        status: PlayerStatus.READY,
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockResolvedValue({
        ...player,
        status: PlayerStatus.PLAYING,
      });

      const result = await service.updatePlayerStatus(
        'session-1',
        'player-1',
        PlayerStatus.PLAYING,
      );

      expect(result.status).toBe(PlayerStatus.PLAYING);
    });

    it('should not update lastConnectedAt when status is DISCONNECTED', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.IN_PROGRESS,
      });
      const originalDate = new Date('2024-01-01');
      const player = createMockPlayer({
        id: 'player-1',
        status: PlayerStatus.PLAYING,
        lastConnectedAt: originalDate,
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockImplementation((p) => Promise.resolve(p));

      await service.updatePlayerStatus(
        'session-1',
        'player-1',
        PlayerStatus.DISCONNECTED,
      );

      expect(playerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PlayerStatus.DISCONNECTED,
        }),
      );
    });

    it('should throw NotFoundException if player not found', async () => {
      playerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updatePlayerStatus(
          'session-1',
          'player-1',
          PlayerStatus.PLAYING,
        ),
      ).rejects.toThrow(
        'Player with ID player-1 not found in session session-1',
      );
    });
  });

  describe('getSessionPlayers', () => {
    it('should return all players in session', async () => {
      const players = [
        createMockPlayer({ id: 'p1', name: 'Alice' }),
        createMockPlayer({ id: 'p2', name: 'Bob' }),
      ];
      const session = createMockSession({
        id: 'session-1',
        players: players as Player[],
      });

      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.getSessionPlayers('session-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should throw NotFoundException if session not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.getSessionPlayers('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removePlayerFromSession', () => {
    it('should remove player from scheduled session', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
      });
      const player = createMockPlayer({
        id: 'player-1',
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.remove.mockResolvedValue(undefined);

      await service.removePlayerFromSession('session-1', 'player-1');

      expect(playerRepo.remove).toHaveBeenCalledWith(player);
    });

    it('should throw NotFoundException if player not found', async () => {
      playerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removePlayerFromSession('session-1', 'player-1'),
      ).rejects.toThrow(
        'Player with ID player-1 not found in session session-1',
      );
    });

    it('should throw BadRequestException if session in progress', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.IN_PROGRESS,
      });
      const player = createMockPlayer({
        id: 'player-1',
        session: session as Session,
      });

      playerRepo.findOne.mockResolvedValue(player);

      await expect(
        service.removePlayerFromSession('session-1', 'player-1'),
      ).rejects.toThrow('Cannot remove players from a session in progress');
    });
  });

  describe('kickPlayer', () => {
    it('should kick player from session and remove from teams', async () => {
      const player = createMockPlayer({ id: 'player-1' });
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        players: [player as Player],
      });
      const team = createMockTeam({
        id: 'team-1',
        players: [player as Player],
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(player);
      teamRepo.find.mockResolvedValue([team]);
      teamRepo.save.mockResolvedValue({ ...team, players: [] });
      sessionRepo.save.mockResolvedValue({ ...session, players: [] });
      playerRepo.remove.mockResolvedValue(undefined);

      const result = await service.kickPlayer('session-1', 'player-1');

      expect(result.players).not.toContain(player);
      expect(teamRepo.save).toHaveBeenCalled();
      expect(playerRepo.remove).toHaveBeenCalledWith(player);
    });

    it('should throw BadRequestException if session is completed', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.COMPLETED,
      });

      sessionRepo.findOne.mockResolvedValue(session);

      await expect(
        service.kickPlayer('session-1', 'player-1'),
      ).rejects.toThrow('Cannot kick players from completed session');
    });

    it('should throw NotFoundException if player not found', async () => {
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        players: [],
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.kickPlayer('session-1', 'player-1'),
      ).rejects.toThrow('Player with ID player-1 not found');
    });

    it('should throw BadRequestException if player not in session', async () => {
      const player = createMockPlayer({ id: 'player-1' });
      const session = createMockSession({
        id: 'session-1',
        status: SessionStatus.SCHEDULED,
        players: [], // Player not in session
      });

      sessionRepo.findOne.mockResolvedValue(session);
      playerRepo.findOne.mockResolvedValue(player);

      await expect(
        service.kickPlayer('session-1', 'player-1'),
      ).rejects.toThrow('Player is not in this session');
    });
  });
});
