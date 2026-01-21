import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlayerService } from './player.service';
import { Player, PlayerStatus } from './player.entity';
import { Session } from '../session/session.entity';
import { SessionGateway } from '../session/session.gateway';
import { createMockRepository } from '../../test/utils/test-db';
import {
  createMockPlayer,
  createMockSession,
  resetTestCounters,
  createMockSessionGateway,
} from '../../test/utils/test-helpers';

describe('Player Online Tracking', () => {
  let service: PlayerService;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let sessionRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    playerRepo = createMockRepository<Player>();
    sessionRepo = createMockRepository<Session>();
    const sessionGateway = createMockSessionGateway();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerService,
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepo,
        },
        {
          provide: SessionGateway,
          useValue: sessionGateway,
        },
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setPlayerOnline', () => {
    it('should mark player as online with socket ID', async () => {
      const player = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        isOnline: false,
        currentSocketId: undefined,
        status: PlayerStatus.DISCONNECTED,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.setPlayerOnline('player-1', 'socket-abc123');

      expect(result.isOnline).toBe(true);
      expect(result.currentSocketId).toBe('socket-abc123');
      expect(result.status).toBe(PlayerStatus.JOINED); // Should change from DISCONNECTED
      expect(result.lastConnectedAt).toBeDefined();
    });

    it('should not change status if player was not disconnected', async () => {
      const player = createMockPlayer({
        id: 'player-1',
        isOnline: false,
        status: PlayerStatus.READY,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.setPlayerOnline('player-1', 'socket-123');

      expect(result.isOnline).toBe(true);
      expect(result.status).toBe(PlayerStatus.READY); // Should remain READY
    });
  });

  describe('setPlayerOffline', () => {
    it('should mark player as offline and clear socket ID', async () => {
      const player = createMockPlayer({
        id: 'player-1',
        name: 'Bob',
        isOnline: true,
        currentSocketId: 'socket-xyz789',
        status: PlayerStatus.PLAYING,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.setPlayerOffline('player-1');

      expect(result.isOnline).toBe(false);
      expect(result.currentSocketId).toBeUndefined();
      expect(result.status).toBe(PlayerStatus.DISCONNECTED);
    });
  });

  describe('findByUserId', () => {
    it('should find player by userId', async () => {
      const player = createMockPlayer({
        id: 'player-1',
        userId: 'user-123',
        name: 'Charlie',
      });

      playerRepo.findOne.mockResolvedValue(player);

      const result = await service.findByUserId('user-123');

      expect(result).toEqual(player);
      expect(playerRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        relations: ['session'],
      });
    });

    it('should return null if player not found', async () => {
      playerRepo.findOne.mockResolvedValue(null);

      const result = await service.findByUserId('non-existent-user');

      expect(result).toBeNull();
    });
  });

  describe('findBySocketId', () => {
    it('should find player by socket ID', async () => {
      const player = createMockPlayer({
        id: 'player-1',
        currentSocketId: 'socket-abc',
        isOnline: true,
      });

      playerRepo.findOne.mockResolvedValue(player);

      const result = await service.findBySocketId('socket-abc');

      expect(result).toEqual(player);
      expect(playerRepo.findOne).toHaveBeenCalledWith({
        where: { currentSocketId: 'socket-abc' },
        relations: ['session'],
      });
    });
  });

  describe('getAllOnlinePlayers', () => {
    it('should return only online players in session', async () => {
      const session = createMockSession({ id: 'session-1' });
      const onlinePlayers = [
        createMockPlayer({
          id: 'player-1',
          name: 'Alice',
          isOnline: true,
          session: session as Session,
        }),
        createMockPlayer({
          id: 'player-2',
          name: 'Bob',
          isOnline: true,
          session: session as Session,
        }),
      ];

      playerRepo.find.mockResolvedValue(onlinePlayers);

      const result = await service.getAllOnlinePlayers('session-1');

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.isOnline)).toBe(true);
      expect(playerRepo.find).toHaveBeenCalledWith({
        where: {
          session: { id: 'session-1' },
          isOnline: true,
        },
        relations: ['session', 'teams'],
        order: { name: 'ASC' },
      });
    });

    it('should return empty array if no online players', async () => {
      playerRepo.find.mockResolvedValue([]);

      const result = await service.getAllOnlinePlayers('session-1');

      expect(result).toEqual([]);
    });
  });

  describe('online status workflow', () => {
    it('should handle complete connect-disconnect cycle', async () => {
      const player = createMockPlayer({
        id: 'player-1',
        name: 'Alice',
        isOnline: false,
        currentSocketId: undefined,
        status: PlayerStatus.JOINED,
      });

      playerRepo.findOne.mockResolvedValue(player);
      playerRepo.save.mockImplementation((p) => Promise.resolve(p));

      // Step 1: Player connects
      let result = await service.setPlayerOnline('player-1', 'socket-123');
      expect(result.isOnline).toBe(true);
      expect(result.currentSocketId).toBe('socket-123');

      // Step 2: Player disconnects
      result = await service.setPlayerOffline('player-1');
      expect(result.isOnline).toBe(false);
      expect(result.currentSocketId).toBeUndefined();
      expect(result.status).toBe(PlayerStatus.DISCONNECTED);

      // Step 3: Player reconnects
      result = await service.setPlayerOnline('player-1', 'socket-456');
      expect(result.isOnline).toBe(true);
      expect(result.currentSocketId).toBe('socket-456');
      expect(result.status).toBe(PlayerStatus.JOINED); // Restored from DISCONNECTED
    });
  });
});
