import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TeamFormationService } from './team-formation.service';
import { Team } from '../team.entity';
import { Game } from '../../game/game.entity';
import { Player, PlayerStatus } from '../../player/player.entity';
import { Session } from '../../session/session.entity';
import { SessionGateway } from '../../session/session.gateway';
import { TeamFormationStrategy } from '../dto/team-formation.dto';
import { createMockRepository } from '../../../test/utils/test-db';
import {
  createMockSession,
  createMockPlayer,
  createMockTeam,
  createMockGame,
  createMockGameLibrary,
  resetTestCounters,
  MockSessionGateway,
  createMockSessionGateway,
} from '../../../test/utils/test-helpers';
import { GameLibrary } from '../../game-library/game-library.entity';

describe('TeamFormationService', () => {
  let service: TeamFormationService;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let sessionGateway: MockSessionGateway;

  beforeEach(async () => {
    teamRepo = createMockRepository<Team>();
    gameRepo = createMockRepository<Game>();
    sessionGateway = createMockSessionGateway();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamFormationService,
        {
          provide: getRepositoryToken(Team),
          useValue: teamRepo,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: SessionGateway,
          useValue: sessionGateway,
        },
      ],
    }).compile();

    service = module.get<TeamFormationService>(TeamFormationService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTeamsForGame', () => {
    it('should create teams for a game with automatic strategy', async () => {
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p3', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p4', status: PlayerStatus.PLAYING }),
      ];
      const session = createMockSession({
        id: 'session-1',
        players: players as Player[],
      });
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 8,
      });
      const game = createMockGame({
        id: 'game-1',
        session: session as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.find.mockResolvedValueOnce([]); // clearTeamsForGame - no existing teams
      teamRepo.create.mockImplementation((data) => ({
        ...data,
        id: `team-${Date.now()}`,
      }));
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));
      teamRepo.find.mockResolvedValue([
        createMockTeam({
          id: 'team-1',
          players: [players[0] as Player, players[2] as Player],
        }),
        createMockTeam({
          id: 'team-2',
          players: [players[1] as Player, players[3] as Player],
        }),
      ]);

      const result = await service.createTeamsForGame('game-1', {
        teamCount: 2,
        strategy: TeamFormationStrategy.AUTOMATIC,
      });

      expect(result).toHaveLength(2);
      expect(teamRepo.create).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastTeamCreated).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createTeamsForGame('invalid-id', {
          teamCount: 2,
          strategy: TeamFormationStrategy.AUTOMATIC,
        }),
      ).rejects.toThrow('Game with ID invalid-id not found');
    });

    it('should throw BadRequestException if no active players', async () => {
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.JOINED }), // Not PLAYING
        createMockPlayer({ id: 'p2', status: PlayerStatus.READY }), // Not PLAYING
      ];
      const session = createMockSession({
        id: 'session-1',
        players: players as Player[],
      });
      const game = createMockGame({
        id: 'game-1',
        session: session as Session,
      });

      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.createTeamsForGame('game-1', {
          teamCount: 2,
          strategy: TeamFormationStrategy.AUTOMATIC,
        }),
      ).rejects.toThrow('No active players found for team formation');
    });

    it('should throw BadRequestException if team count exceeds players', async () => {
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.PLAYING }),
      ];
      const session = createMockSession({
        id: 'session-1',
        players: players as Player[],
      });
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 8,
      });
      const game = createMockGame({
        id: 'game-1',
        session: session as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      gameRepo.findOne.mockResolvedValue(game);

      await expect(
        service.createTeamsForGame('game-1', {
          teamCount: 5, // More teams than players
          strategy: TeamFormationStrategy.AUTOMATIC,
        }),
      ).rejects.toThrow('Team formation validation failed');
    });

    it('should use custom team names and colors if provided', async () => {
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p3', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p4', status: PlayerStatus.PLAYING }),
      ];
      const session = createMockSession({
        id: 'session-1',
        players: players as Player[],
      });
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 8,
      });
      const game = createMockGame({
        id: 'game-1',
        session: session as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.find.mockResolvedValueOnce([]); // clearTeamsForGame
      teamRepo.create.mockImplementation((data) => ({
        ...data,
        id: `team-${Date.now()}`,
      }));
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));
      teamRepo.find.mockResolvedValue([]);

      await service.createTeamsForGame('game-1', {
        teamCount: 2,
        strategy: TeamFormationStrategy.AUTOMATIC,
        teamNames: ['Alpha', 'Beta'],
        teamColors: ['#FF0000', '#00FF00'],
      });

      expect(teamRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alpha', color: '#FF0000' }),
      );
      expect(teamRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Beta', color: '#00FF00' }),
      );
    });
  });

  describe('clearTeamsForGame', () => {
    it('should clear existing teams for a game', async () => {
      const session = createMockSession({ id: 'session-1' });
      const existingTeams = [
        createMockTeam({ id: 'team-1', session: session as Session }),
        createMockTeam({ id: 'team-2', session: session as Session }),
      ];

      teamRepo.find.mockResolvedValue(existingTeams);
      teamRepo.remove.mockResolvedValue(undefined);

      await service.clearTeamsForGame('game-1');

      expect(teamRepo.remove).toHaveBeenCalledWith(existingTeams);
      expect(sessionGateway.broadcastTeamDeleted).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if no existing teams', async () => {
      teamRepo.find.mockResolvedValue([]);

      await service.clearTeamsForGame('game-1');

      expect(teamRepo.remove).not.toHaveBeenCalled();
      expect(sessionGateway.broadcastTeamDeleted).not.toHaveBeenCalled();
    });
  });

  describe('suggestTeamFormation', () => {
    it('should return team formation suggestions', async () => {
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p3', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p4', status: PlayerStatus.PLAYING }),
      ];
      const session = createMockSession({
        id: 'session-1',
        players: players as Player[],
      });
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 8,
      });
      const game = createMockGame({
        id: 'game-1',
        session: session as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      gameRepo.findOne.mockResolvedValue(game);

      const result = await service.suggestTeamFormation('game-1');

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.validation).toBeDefined();
      expect(result.validation.isValid).toBe(true);
    });

    it('should throw NotFoundException if game not found', async () => {
      gameRepo.findOne.mockResolvedValue(null);

      await expect(service.suggestTeamFormation('invalid-id')).rejects.toThrow(
        'Game with ID invalid-id not found',
      );
    });
  });

  describe('validateTeamFormation', () => {
    it('should return valid for proper team formation', () => {
      const result = service.validateTeamFormation(4, 2, {
        minPlayers: 2,
        maxPlayers: 8,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for less than 2 teams', () => {
      const result = service.validateTeamFormation(4, 1, null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least 2 teams are required');
    });

    it('should return error for not enough players', () => {
      const result = service.validateTeamFormation(2, 5, null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Not enough players (2) for 5 teams');
    });

    it('should return warning for uneven teams', () => {
      const result = service.validateTeamFormation(5, 2, null);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate against game requirements', () => {
      const result = service.validateTeamFormation(2, 2, {
        minPlayers: 4,
        maxPlayers: 8,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Game requires at least 4 players, but only 2 available',
      );
    });
  });

  describe('assignPlayersByStrategy', () => {
    it('should assign players using RANDOM strategy', async () => {
      const players = [
        createMockPlayer({ id: 'p1' }) as Player,
        createMockPlayer({ id: 'p2' }) as Player,
        createMockPlayer({ id: 'p3' }) as Player,
        createMockPlayer({ id: 'p4' }) as Player,
      ];
      const teams = [
        { ...createMockTeam({ id: 'team-1' }), players: [] } as Team,
        { ...createMockTeam({ id: 'team-2' }), players: [] } as Team,
      ];

      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      await service.assignPlayersByStrategy(
        teams,
        players,
        TeamFormationStrategy.RANDOM,
      );

      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      const totalAssigned = teams[0].players.length + teams[1].players.length;
      expect(totalAssigned).toBe(4);
    });

    it('should assign players using BALANCED strategy', async () => {
      const players = [
        createMockPlayer({
          id: 'p1',
          createdAt: new Date('2024-01-01'),
        }) as Player,
        createMockPlayer({
          id: 'p2',
          createdAt: new Date('2024-01-02'),
        }) as Player,
        createMockPlayer({
          id: 'p3',
          createdAt: new Date('2024-01-03'),
        }) as Player,
        createMockPlayer({
          id: 'p4',
          createdAt: new Date('2024-01-04'),
        }) as Player,
      ];
      const teams = [
        { ...createMockTeam({ id: 'team-1' }), players: [] } as Team,
        { ...createMockTeam({ id: 'team-2' }), players: [] } as Team,
      ];

      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      await service.assignPlayersByStrategy(
        teams,
        players,
        TeamFormationStrategy.BALANCED,
      );

      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      // Each team should have 2 players
      expect(teams[0].players.length).toBe(2);
      expect(teams[1].players.length).toBe(2);
    });

    it('should assign players using AUTOMATIC strategy', async () => {
      const players = [
        createMockPlayer({ id: 'p1' }) as Player,
        createMockPlayer({ id: 'p2' }) as Player,
        createMockPlayer({ id: 'p3' }) as Player,
        createMockPlayer({ id: 'p4' }) as Player,
      ];
      const teams = [
        { ...createMockTeam({ id: 'team-1' }), players: [] } as Team,
        { ...createMockTeam({ id: 'team-2' }), players: [] } as Team,
      ];

      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      await service.assignPlayersByStrategy(
        teams,
        players,
        TeamFormationStrategy.AUTOMATIC,
      );

      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      const totalAssigned = teams[0].players.length + teams[1].players.length;
      expect(totalAssigned).toBe(4);
    });
  });
});
