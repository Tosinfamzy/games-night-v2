import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamService } from './team.service';
import { Team } from './team.entity';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Player, PlayerStatus } from '../player/player.entity';
import { SessionGateway } from '../session/session.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TeamService - Team Management', () => {
  let service: TeamService;
  let teamRepo: Repository<Team>;
  let playerRepo: Repository<Player>;
  let sessionGateway: SessionGateway;

  const mockSessionGateway = {
    broadcastTeamUpdated: jest.fn(),
    broadcastTeamDeleted: jest.fn(),
    broadcastPlayerAssignedToTeam: jest.fn(),
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
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
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    teamRepo = module.get<Repository<Team>>(getRepositoryToken(Team));
    playerRepo = module.get<Repository<Player>>(getRepositoryToken(Player));
    sessionGateway = module.get<SessionGateway>(SessionGateway);

    jest.clearAllMocks();
  });

  describe('swapPlayerToTeam', () => {
    const playerId = 'player-1';
    const fromTeamId = 'team-1';
    const toTeamId = 'team-2';
    const sessionId = 'session-1';
    const gameId = 'game-1';

    const mockPlayer: Partial<Player> = {
      id: playerId,
      name: 'Test Player',
    };

    const mockGame: Partial<Game> = {
      id: gameId,
    };

    const mockSession: Partial<Session> = {
      id: sessionId,
    };

    const mockFromTeam: Partial<Team> = {
      id: fromTeamId,
      name: 'Team Alpha',
      game: mockGame as Game,
      session: mockSession as Session,
      players: [mockPlayer as Player],
    };

    const mockToTeam: Partial<Team> = {
      id: toTeamId,
      name: 'Team Beta',
      game: mockGame as Game,
      session: mockSession as Session,
      players: [],
    };

    it('should successfully swap a player between teams', async () => {
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(mockFromTeam as Team)
        .mockResolvedValueOnce(mockToTeam as Team);

      jest.spyOn(playerRepo, 'findOne').mockResolvedValue(mockPlayer as Player);

      const savedFromTeam = { ...mockFromTeam, players: [] };
      const savedToTeam = { ...mockToTeam, players: [mockPlayer as Player] };

      jest
        .spyOn(teamRepo, 'save')
        .mockResolvedValueOnce(savedFromTeam as Team)
        .mockResolvedValueOnce(savedToTeam as Team);

      const result = await service.swapPlayerToTeam(
        playerId,
        fromTeamId,
        toTeamId,
      );

      expect(result).toEqual({
        fromTeam: savedFromTeam,
        toTeam: savedToTeam,
      });

      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastTeamUpdated).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastPlayerAssignedToTeam).toHaveBeenCalledWith(
        sessionId,
        toTeamId,
        playerId,
      );
    });

    it('should throw NotFoundException if fromTeam does not exist', async () => {
      jest.spyOn(teamRepo, 'findOne').mockResolvedValueOnce(null);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if toTeam does not exist', async () => {
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(mockFromTeam as Team)
        .mockResolvedValueOnce(null);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if teams are from different games', async () => {
      const differentGameTeam = {
        ...mockToTeam,
        game: { id: 'different-game' } as Game,
      };

      // First call to swapPlayerToTeam
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(mockFromTeam as Team)
        .mockResolvedValueOnce(differentGameTeam as Team);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow(BadRequestException);

      // Second call to swapPlayerToTeam - need to set up mocks again
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(mockFromTeam as Team)
        .mockResolvedValueOnce(differentGameTeam as Team);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow(
        'Cannot swap players between teams from different games',
      );
    });

    it('should throw NotFoundException if player does not exist', async () => {
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(mockFromTeam as Team)
        .mockResolvedValueOnce(mockToTeam as Team);

      jest.spyOn(playerRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if player is not in fromTeam', async () => {
      const teamWithoutPlayer = {
        ...mockFromTeam,
        players: [],
      };

      // First call to swapPlayerToTeam
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(teamWithoutPlayer as Team)
        .mockResolvedValueOnce(mockToTeam as Team);

      jest.spyOn(playerRepo, 'findOne').mockResolvedValue(mockPlayer as Player);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow(BadRequestException);

      // Second call to swapPlayerToTeam - need to set up mocks again
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValueOnce(teamWithoutPlayer as Team)
        .mockResolvedValueOnce(mockToTeam as Team);

      await expect(
        service.swapPlayerToTeam(playerId, fromTeamId, toTeamId),
      ).rejects.toThrow('is not in team');
    });
  });

  describe('dissolveTeam', () => {
    const teamId = 'team-1';
    const sessionId = 'session-1';

    const mockPlayers = [
      { id: 'player-1', name: 'Player 1' } as Player,
      { id: 'player-2', name: 'Player 2' } as Player,
    ];

    const mockTeam: Partial<Team> = {
      id: teamId,
      name: 'Team Alpha',
      session: { id: sessionId } as Session,
      players: mockPlayers,
    };

    it('should successfully dissolve a team', async () => {
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(mockTeam as Team);
      jest.spyOn(teamRepo, 'remove').mockResolvedValue(mockTeam as Team);

      await service.dissolveTeam(teamId);

      expect(teamRepo.remove).toHaveBeenCalledWith(mockTeam);
      expect(sessionGateway.broadcastTeamDeleted).toHaveBeenCalledWith(
        sessionId,
        teamId,
      );
      expect(sessionGateway.server.to).toHaveBeenCalledWith(
        `session:${sessionId}`,
      );
      expect(sessionGateway.server.emit).toHaveBeenCalledTimes(2); // Once per player
    });

    it('should emit player-unassigned events for all players', async () => {
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(mockTeam as Team);
      jest.spyOn(teamRepo, 'remove').mockResolvedValue(mockTeam as Team);

      await service.dissolveTeam(teamId);

      expect(sessionGateway.server.emit).toHaveBeenNthCalledWith(
        1,
        'team:player-unassigned',
        expect.objectContaining({
          sessionId,
          playerId: 'player-1',
          teamId,
        }),
      );

      expect(sessionGateway.server.emit).toHaveBeenNthCalledWith(
        2,
        'team:player-unassigned',
        expect.objectContaining({
          sessionId,
          playerId: 'player-2',
          teamId,
        }),
      );
    });

    it('should throw NotFoundException if team does not exist', async () => {
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(null);

      await expect(service.dissolveTeam(teamId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle team with no session gracefully', async () => {
      const teamWithoutSession = { ...mockTeam, session: null };
      jest
        .spyOn(teamRepo, 'findOne')
        .mockResolvedValue(teamWithoutSession as unknown as Team);
      jest
        .spyOn(teamRepo, 'remove')
        .mockResolvedValue(teamWithoutSession as unknown as Team);

      await service.dissolveTeam(teamId);

      expect(teamRepo.remove).toHaveBeenCalledWith(teamWithoutSession);
      // Should not broadcast if no session
      expect(sessionGateway.broadcastTeamDeleted).not.toHaveBeenCalled();
    });
  });

  describe('reassignPlayer', () => {
    const playerId = 'player-1';
    const newTeamId = 'team-2';
    const currentTeamId = 'team-1';
    const gameId = 'game-1';
    const sessionId = 'session-1';

    const mockGame: Partial<Game> = {
      id: gameId,
    };

    const mockSession: Partial<Session> = {
      id: sessionId,
    };

    const mockCurrentTeam: Partial<Team> = {
      id: currentTeamId,
      name: 'Current Team',
      game: mockGame as Game,
      session: mockSession as Session,
      players: [{ id: playerId, name: 'Test Player' } as Player],
    };

    const mockNewTeam: Partial<Team> = {
      id: newTeamId,
      name: 'New Team',
      game: mockGame as Game,
      session: mockSession as Session,
      players: [],
    };

    const mockPlayer: Partial<Player> = {
      id: playerId,
      name: 'Test Player',
      teams: [mockCurrentTeam as Team],
    };

    it('should successfully reassign a player to a new team', async () => {
      jest.spyOn(playerRepo, 'findOne').mockResolvedValue(mockPlayer as Player);
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(mockNewTeam as Team);

      const savedCurrentTeam = { ...mockCurrentTeam, players: [] };
      const savedNewTeam = {
        ...mockNewTeam,
        players: [mockPlayer as Player],
      };

      jest
        .spyOn(teamRepo, 'save')
        .mockResolvedValueOnce(savedCurrentTeam as Team)
        .mockResolvedValueOnce(savedNewTeam as Team);

      const result = await service.reassignPlayer(playerId, newTeamId);

      expect(result).toEqual(savedNewTeam);
      expect(teamRepo.save).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastTeamUpdated).toHaveBeenCalledTimes(2);
      expect(sessionGateway.broadcastPlayerAssignedToTeam).toHaveBeenCalledWith(
        sessionId,
        newTeamId,
        playerId,
      );
    });

    it('should throw NotFoundException if player does not exist', async () => {
      jest.spyOn(playerRepo, 'findOne').mockResolvedValue(null);

      await expect(service.reassignPlayer(playerId, newTeamId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if new team does not exist', async () => {
      jest.spyOn(playerRepo, 'findOne').mockResolvedValue(mockPlayer as Player);
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(null);

      await expect(service.reassignPlayer(playerId, newTeamId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle player with no current team', async () => {
      const playerWithoutTeam = { ...mockPlayer, teams: [] };
      jest
        .spyOn(playerRepo, 'findOne')
        .mockResolvedValue(playerWithoutTeam as Player);
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(mockNewTeam as Team);

      const savedNewTeam = {
        ...mockNewTeam,
        players: [playerWithoutTeam as Player],
      };
      jest.spyOn(teamRepo, 'save').mockResolvedValue(savedNewTeam as Team);

      const result = await service.reassignPlayer(playerId, newTeamId);

      expect(result).toEqual(savedNewTeam);
      expect(teamRepo.save).toHaveBeenCalledTimes(1); // Only save new team
    });

    it('should only remove from current team in same game', async () => {
      const differentGameTeam = {
        id: 'team-3',
        game: { id: 'different-game' } as Game,
      } as Team;

      const playerWithMultipleTeams = {
        ...mockPlayer,
        teams: [mockCurrentTeam as Team, differentGameTeam],
      };

      jest
        .spyOn(playerRepo, 'findOne')
        .mockResolvedValue(playerWithMultipleTeams as Player);
      jest.spyOn(teamRepo, 'findOne').mockResolvedValue(mockNewTeam as Team);
      jest.spyOn(teamRepo, 'save').mockResolvedValue({} as Team);

      await service.reassignPlayer(playerId, newTeamId);

      // Should only update current team (same game), not the different game team
      expect(teamRepo.save).toHaveBeenCalledTimes(2);
    });
  });
});
