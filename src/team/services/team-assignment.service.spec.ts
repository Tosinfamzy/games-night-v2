import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TeamAssignmentService } from './team-assignment.service';
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

describe('TeamAssignmentService', () => {
  let service: TeamAssignmentService;
  let teamRepo: ReturnType<typeof createMockRepository>;
  let gameRepo: ReturnType<typeof createMockRepository>;
  let playerRepo: ReturnType<typeof createMockRepository>;
  let sessionGateway: MockSessionGateway;
  let formationService: { assignPlayersByStrategy: jest.Mock };

  beforeEach(async () => {
    teamRepo = createMockRepository();
    gameRepo = createMockRepository();
    playerRepo = createMockRepository();
    sessionGateway = createMockSessionGateway();
    formationService = {
      assignPlayersByStrategy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamAssignmentService,
        {
          provide: getRepositoryToken(Team),
          useValue: teamRepo,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: gameRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: SessionGateway,
          useValue: sessionGateway,
        },
        {
          provide: TeamFormationService,
          useValue: formationService,
        },
      ],
    }).compile();

    service = module.get<TeamAssignmentService>(TeamAssignmentService);
    resetTestCounters();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('swapPlayerToTeam', () => {
    it('should successfully swap a player between teams', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({ id: 'game-1' });
      const player = createMockPlayer({ id: 'player-1', name: 'Test Player' });

      const fromTeam = {
        ...createMockTeam({ id: 'team-1', name: 'Team Alpha' }),
        game: game as Game,
        session: session as Session,
        players: [player as Player],
      };

      const toTeam = {
        ...createMockTeam({ id: 'team-2', name: 'Team Beta' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };

      teamRepo.findOne
        .mockResolvedValueOnce(fromTeam)
        .mockResolvedValueOnce(toTeam);
      playerRepo.findOne.mockResolvedValue(player);
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      const result = await service.swapPlayerToTeam(
        'player-1',
        'team-1',
        'team-2',
      );

      expect(result.fromTeam).toBeDefined();
      expect(result.toTeam).toBeDefined();
      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastTeamUpdated).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastPlayerAssignedToTeam).toHaveBeenCalledWith(
        'session-1',
        'team-2',
        'player-1',
      );
    });

    it('should throw NotFoundException if fromTeam does not exist', async () => {
      teamRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if toTeam does not exist', async () => {
      const fromTeam = createMockTeam({ id: 'team-1' });
      teamRepo.findOne
        .mockResolvedValueOnce(fromTeam)
        .mockResolvedValueOnce(null);

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if teams are from different games', async () => {
      const game1 = createMockGame({ id: 'game-1' });
      const game2 = createMockGame({ id: 'game-2' });

      const fromTeam = {
        ...createMockTeam({ id: 'team-1' }),
        game: game1 as Game,
      };
      const toTeam = {
        ...createMockTeam({ id: 'team-2' }),
        game: game2 as Game,
      };

      teamRepo.findOne
        .mockResolvedValueOnce(fromTeam)
        .mockResolvedValueOnce(toTeam);

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(
        'Cannot swap players between teams from different games',
      );
    });

    it('should throw NotFoundException if player does not exist', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({ id: 'game-1' });

      const fromTeam = {
        ...createMockTeam({ id: 'team-1' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };
      const toTeam = {
        ...createMockTeam({ id: 'team-2' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };

      teamRepo.findOne
        .mockResolvedValueOnce(fromTeam)
        .mockResolvedValueOnce(toTeam);
      playerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if player is not in fromTeam', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({ id: 'game-1' });
      const player = createMockPlayer({ id: 'player-1', name: 'Test Player' });

      const fromTeam = {
        ...createMockTeam({ id: 'team-1' }),
        game: game as Game,
        session: session as Session,
        players: [], // Player not in team
      };
      const toTeam = {
        ...createMockTeam({ id: 'team-2' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };

      teamRepo.findOne
        .mockResolvedValueOnce(fromTeam)
        .mockResolvedValueOnce(toTeam);
      playerRepo.findOne.mockResolvedValue(player);

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('dissolveTeam', () => {
    it('should successfully dissolve a team', async () => {
      const session = createMockSession({ id: 'session-1' });
      const players = [
        createMockPlayer({ id: 'player-1' }),
        createMockPlayer({ id: 'player-2' }),
      ];

      const team = {
        ...createMockTeam({ id: 'team-1', name: 'Team Alpha' }),
        session: session as Session,
        players: players as Player[],
      };

      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.remove.mockResolvedValue(team);

      await service.dissolveTeam('team-1');

      expect(teamRepo.remove).toHaveBeenCalledWith(team);
      expect(sessionGateway.broadcastTeamDeleted).toHaveBeenCalledWith(
        'session-1',
        'team-1',
      );
    });

    it('should emit player-unassigned events for all players', async () => {
      const session = createMockSession({ id: 'session-1' });
      const players = [
        createMockPlayer({ id: 'player-1' }),
        createMockPlayer({ id: 'player-2' }),
      ];

      const team = {
        ...createMockTeam({ id: 'team-1', name: 'Team Alpha' }),
        session: session as Session,
        players: players as Player[],
      };

      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.remove.mockResolvedValue(team);

      await service.dissolveTeam('team-1');

      // Should emit for each player (via server.to().emit())
      expect(sessionGateway.server.to).toHaveBeenCalledWith(
        'session:session-1',
      );
      // The mock returns { emit: jest.fn() } from .to(), so we check that to() was called for each player
      expect(sessionGateway.server.to).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if team does not exist', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await expect(service.dissolveTeam('team-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle team with no session gracefully', async () => {
      const players = [createMockPlayer({ id: 'player-1' })];
      const team = {
        ...createMockTeam({ id: 'team-1' }),
        session: null,
        game: { session: null },
        players: players as Player[],
      };

      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.remove.mockResolvedValue(team);

      await service.dissolveTeam('team-1');

      expect(teamRepo.remove).toHaveBeenCalledWith(team);
      expect(sessionGateway.broadcastTeamDeleted).not.toHaveBeenCalled();
    });
  });

  describe('reassignPlayer', () => {
    it('should successfully reassign a player to a new team', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({ id: 'game-1' });

      const currentTeam = {
        ...createMockTeam({ id: 'team-1' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };

      const newTeam = {
        ...createMockTeam({ id: 'team-2' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };

      const player = {
        ...createMockPlayer({ id: 'player-1' }),
        teams: [currentTeam as Team],
      };

      playerRepo.findOne.mockResolvedValue(player);
      teamRepo.findOne.mockResolvedValue(newTeam);
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      const result = await service.reassignPlayer('player-1', 'team-2');

      expect(result).toBeDefined();
      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastTeamUpdated).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastPlayerAssignedToTeam).toHaveBeenCalledWith(
        'session-1',
        'team-2',
        'player-1',
      );
    });

    it('should throw NotFoundException if player does not exist', async () => {
      playerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reassignPlayer('player-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if new team does not exist', async () => {
      const player = createMockPlayer({ id: 'player-1', teams: [] });
      playerRepo.findOne.mockResolvedValue(player);
      teamRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reassignPlayer('player-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle player with no current team', async () => {
      const session = createMockSession({ id: 'session-1' });
      const game = createMockGame({ id: 'game-1' });

      const newTeam = {
        ...createMockTeam({ id: 'team-2' }),
        game: game as Game,
        session: session as Session,
        players: [],
      };

      const player = {
        ...createMockPlayer({ id: 'player-1' }),
        teams: [],
      };

      playerRepo.findOne.mockResolvedValue(player);
      teamRepo.findOne.mockResolvedValue(newTeam);
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      const result = await service.reassignPlayer('player-1', 'team-2');

      expect(result).toBeDefined();
      expect(teamRepo.save).toHaveBeenCalledTimes(1); // Only save new team
    });
  });

  describe('manualAssignPlayers', () => {
    it('should manually assign players to teams', async () => {
      const session = createMockSession({ id: 'session-1' });
      const players = [
        createMockPlayer({ id: 'player-1' }),
        createMockPlayer({ id: 'player-2' }),
      ];

      const teams = [
        {
          ...createMockTeam({ id: 'team-1' }),
          session: session as Session,
          players: [],
        },
        {
          ...createMockTeam({ id: 'team-2' }),
          session: session as Session,
          players: [],
        },
      ];

      teamRepo.find.mockResolvedValue(teams);
      playerRepo.find.mockResolvedValue(players);
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      const result = await service.manualAssignPlayers('game-1', {
        teamAssignments: {
          'team-1': ['player-1'],
          'team-2': ['player-2'],
        },
      });

      expect(result).toHaveLength(2);
      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastPlayerAssignedToTeam).toHaveBeenCalled();
    });

    it('should throw NotFoundException if team not found in assignments', async () => {
      const teams = [createMockTeam({ id: 'team-1' })];
      teamRepo.find.mockResolvedValue(teams);

      await expect(
        service.manualAssignPlayers('game-1', {
          teamAssignments: {
            'nonexistent-team': ['player-1'],
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rebalanceTeams', () => {
    it('should rebalance teams using a different strategy', async () => {
      const session = createMockSession({ id: 'session-1' });
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p3', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p4', status: PlayerStatus.PLAYING }),
      ];
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 8,
      });
      const game = createMockGame({
        id: 'game-1',
        session: { ...session, players: players as Player[] } as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      const teams = [
        {
          ...createMockTeam({ id: 'team-1' }),
          session: session as Session,
          players: [players[0], players[1]] as Player[],
        },
        {
          ...createMockTeam({ id: 'team-2' }),
          session: session as Session,
          players: [players[2], players[3]] as Player[],
        },
      ];

      teamRepo.find.mockResolvedValue(teams);
      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      const result = await service.rebalanceTeams(
        'game-1',
        TeamFormationStrategy.RANDOM,
      );

      expect(result).toHaveLength(2);
      expect(formationService.assignPlayersByStrategy).toHaveBeenCalled();
    });

    it('should throw BadRequestException if no teams found', async () => {
      teamRepo.find.mockResolvedValue([]);

      await expect(
        service.rebalanceTeams('game-1', TeamFormationStrategy.RANDOM),
      ).rejects.toThrow('No teams found to rebalance');
    });

    it('should throw NotFoundException if game not found', async () => {
      const teams = [createMockTeam({ id: 'team-1' })];
      teamRepo.find.mockResolvedValue(teams);
      gameRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rebalanceTeams('game-1', TeamFormationStrategy.RANDOM),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('shufflePlayers', () => {
    it('should shuffle players across existing teams', async () => {
      const session = createMockSession({ id: 'session-1' });
      const players = [
        createMockPlayer({ id: 'p1', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p2', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p3', status: PlayerStatus.PLAYING }),
        createMockPlayer({ id: 'p4', status: PlayerStatus.PLAYING }),
      ];
      const gameLibrary = createMockGameLibrary({
        minPlayers: 2,
        maxPlayers: 8,
      });
      const game = createMockGame({
        id: 'game-1',
        session: { ...session, players: players as Player[] } as Session,
        gameLibrary: gameLibrary as GameLibrary,
      });

      const teams = [
        {
          ...createMockTeam({ id: 'team-1' }),
          session: session as Session,
          players: [players[0], players[1]] as Player[],
        },
        {
          ...createMockTeam({ id: 'team-2' }),
          session: session as Session,
          players: [players[2], players[3]] as Player[],
        },
      ];

      teamRepo.find.mockResolvedValue(teams);
      gameRepo.findOne.mockResolvedValue(game);
      teamRepo.save.mockImplementation((team) => Promise.resolve(team));

      const result = await service.shufflePlayers('game-1');

      expect(result).toHaveLength(2);
      expect(teamRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if no teams found', async () => {
      teamRepo.find.mockResolvedValue([]);

      await expect(service.shufflePlayers('game-1')).rejects.toThrow(
        'No teams found to shuffle',
      );
    });

    it('should throw NotFoundException if game not found', async () => {
      const teams = [createMockTeam({ id: 'team-1' })];
      teamRepo.find.mockResolvedValue(teams);
      gameRepo.findOne.mockResolvedValue(null);

      await expect(service.shufflePlayers('game-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
