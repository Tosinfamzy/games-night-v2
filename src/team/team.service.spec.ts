import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeamService } from './team.service';
import { TeamFormationService } from './services/team-formation.service';
import { TeamAssignmentService } from './services/team-assignment.service';
import { Team } from './team.entity';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Player } from '../player/player.entity';
import { SessionGateway } from '../session/session.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TeamService - Team Management', () => {
  let service: TeamService;

  const mockSessionGateway = {
    broadcastTeamUpdated: jest.fn(),
    broadcastTeamDeleted: jest.fn(),
    broadcastPlayerAssignedToTeam: jest.fn(),
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };

  const mockTeamFormationService = {
    createTeamsForGame: jest.fn(),
    clearTeamsForGame: jest.fn(),
    suggestTeamFormation: jest.fn(),
    assignPlayersByStrategy: jest.fn(),
    validateTeamFormation: jest.fn(),
  };

  const mockTeamAssignmentService = {
    manualAssignPlayers: jest.fn(),
    rebalanceTeams: jest.fn(),
    shufflePlayers: jest.fn(),
    swapPlayerToTeam: jest.fn(),
    dissolveTeam: jest.fn(),
    reassignPlayer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: getRepositoryToken(Team),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Game),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Player),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: SessionGateway,
          useValue: mockSessionGateway,
        },
        {
          provide: TeamFormationService,
          useValue: mockTeamFormationService,
        },
        {
          provide: TeamAssignmentService,
          useValue: mockTeamAssignmentService,
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);

    jest.clearAllMocks();
  });

  describe('swapPlayerToTeam', () => {
    it('should delegate to teamAssignmentService.swapPlayerToTeam', async () => {
      const mockResult = {
        fromTeam: {
          id: 'team-1',
          name: 'Team A',
          players: [],
        } as unknown as Team,
        toTeam: {
          id: 'team-2',
          name: 'Team B',
          players: [],
        } as unknown as Team,
      };
      mockTeamAssignmentService.swapPlayerToTeam.mockResolvedValue(mockResult);

      const result = await service.swapPlayerToTeam(
        'player-1',
        'team-1',
        'team-2',
      );

      expect(mockTeamAssignmentService.swapPlayerToTeam).toHaveBeenCalledWith(
        'player-1',
        'team-1',
        'team-2',
      );
      expect(result).toEqual(mockResult);
    });

    it('should propagate NotFoundException from assignmentService', async () => {
      mockTeamAssignmentService.swapPlayerToTeam.mockRejectedValue(
        new NotFoundException('Team not found'),
      );

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from assignmentService', async () => {
      mockTeamAssignmentService.swapPlayerToTeam.mockRejectedValue(
        new BadRequestException(
          'Cannot swap players between teams from different games',
        ),
      );

      await expect(
        service.swapPlayerToTeam('player-1', 'team-1', 'team-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('dissolveTeam', () => {
    it('should delegate to teamAssignmentService.dissolveTeam', async () => {
      mockTeamAssignmentService.dissolveTeam.mockResolvedValue(undefined);

      await service.dissolveTeam('team-1');

      expect(mockTeamAssignmentService.dissolveTeam).toHaveBeenCalledWith(
        'team-1',
      );
    });

    it('should propagate NotFoundException from assignmentService', async () => {
      mockTeamAssignmentService.dissolveTeam.mockRejectedValue(
        new NotFoundException('Team not found'),
      );

      await expect(service.dissolveTeam('team-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reassignPlayer', () => {
    it('should delegate to teamAssignmentService.reassignPlayer', async () => {
      const mockNewTeam = { id: 'team-2', name: 'New Team' } as Team;
      mockTeamAssignmentService.reassignPlayer.mockResolvedValue(mockNewTeam);

      const result = await service.reassignPlayer('player-1', 'team-2');

      expect(mockTeamAssignmentService.reassignPlayer).toHaveBeenCalledWith(
        'player-1',
        'team-2',
      );
      expect(result).toEqual(mockNewTeam);
    });

    it('should propagate NotFoundException from assignmentService', async () => {
      mockTeamAssignmentService.reassignPlayer.mockRejectedValue(
        new NotFoundException('Player not found'),
      );

      await expect(
        service.reassignPlayer('player-1', 'team-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
