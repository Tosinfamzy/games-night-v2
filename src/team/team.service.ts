import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findOneOrThrow } from '../common/utils/find-or-throw.util';
import { Team } from './team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import {
  CreateTeamsDto,
  AssignPlayersDto,
  TeamFormationStrategy,
} from './dto/team-formation.dto';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Player } from '../player/player.entity';
import { SessionGateway } from '../session/session.gateway';
import { TeamStats } from '../game/interfaces/game.interface';
import { TeamFormationService } from './services/team-formation.service';
import { TeamAssignmentService } from './services/team-assignment.service';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly repo: Repository<Team>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @Inject(forwardRef(() => SessionGateway))
    private readonly sessionGateway: SessionGateway,
    @Inject(forwardRef(() => TeamFormationService))
    private readonly formationService: TeamFormationService,
    @Inject(forwardRef(() => TeamAssignmentService))
    private readonly assignmentService: TeamAssignmentService,
  ) {}

  async create(dto: CreateTeamDto): Promise<Team> {
    const game = await this.gameRepo.findOne({
      where: { id: dto.gameId },
      relations: ['session'],
    });
    if (!game) {
      throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
    }

    const team = this.repo.create({
      name: dto.name,
      game,
    });
    const savedTeam = await this.repo.save(team);

    // Broadcast team created event
    if (game.session) {
      this.sessionGateway.broadcastTeamCreated(game.session.id, savedTeam);
    }

    return savedTeam;
  }

  async findAll(relations: string[] = []): Promise<Team[]> {
    const defaultRelations = ['session', 'game', 'players', 'scores'];
    const mergedRelations = Array.from(
      new Set([...defaultRelations, ...relations]),
    );
    return this.repo.find({
      relations: mergedRelations,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<Team> {
    return findOneOrThrow(
      this.repo,
      { id },
      `Team with ID ${id} not found`,
      relations,
    );
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id, ['game', 'game.session']);

    if (dto.gameId) {
      const game = await this.gameRepo.findOne({
        where: { id: dto.gameId },
        relations: ['session'],
      });
      if (!game) {
        throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
      }
      team.game = game;
    }

    Object.assign(team, {
      name: dto.name ?? team.name,
    });

    const savedTeam = await this.repo.save(team);

    // Broadcast team updated event
    if (team.game?.session) {
      this.sessionGateway.broadcastTeamUpdated(team.game.session.id, savedTeam);
    }

    return savedTeam;
  }

  async delete(id: string): Promise<void> {
    const team = await this.findOne(id, ['game', 'game.session']);
    const sessionId = team.game?.session?.id;
    const teamId = team.id;

    await this.repo.remove(team);

    // Broadcast team deleted event
    if (sessionId) {
      this.sessionGateway.broadcastTeamDeleted(sessionId, teamId);
    }
  }

  async findByGame(gameId: string): Promise<Team[]> {
    return this.repo.find({
      where: { game: { id: gameId } },
      order: { name: 'ASC' },
      relations: ['game', 'players', 'session', 'scores'],
    });
  }

  // Team formation methods (delegated to TeamFormationService)
  async createTeamsForGame(
    gameId: string,
    dto: CreateTeamsDto,
  ): Promise<Team[]> {
    return this.formationService.createTeamsForGame(gameId, dto);
  }

  async clearTeamsForGame(gameId: string): Promise<void> {
    return this.formationService.clearTeamsForGame(gameId);
  }

  // Private methods for assignment strategies are now in TeamFormationService
  // but kept here for backwards compatibility with rebalanceTeams/shufflePlayers
  private async assignPlayersByStrategy(
    teams: Team[],
    players: Player[],
    strategy: TeamFormationStrategy,
  ): Promise<void> {
    return this.formationService.assignPlayersByStrategy(
      teams,
      players,
      strategy,
    );
  }

  // Team assignment methods (delegated to TeamAssignmentService)
  async manualAssignPlayers(
    gameId: string,
    dto: AssignPlayersDto,
  ): Promise<Team[]> {
    return this.assignmentService.manualAssignPlayers(gameId, dto);
  }

  async getTeamStats(gameId: string): Promise<TeamStats[]> {
    const teams = await this.findByGame(gameId);

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      position: team.position,
      playerCount: team.players.length,
      players: team.players.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
      })),
    }));
  }

  /**
   * Validates and suggests optimal team formation for a game
   * Delegated to TeamFormationService
   */
  async suggestTeamFormation(gameId: string): Promise<{
    suggestions: Array<{
      teamCount: number;
      strategy: TeamFormationStrategy;
      playersPerTeam: number;
      remainder: number;
      pros: string[];
      cons: string[];
    }>;
    validation: { isValid: boolean; errors: string[]; warnings: string[] };
  }> {
    return this.formationService.suggestTeamFormation(gameId);
  }

  /**
   * Rebalances existing teams using a different strategy
   * Delegated to TeamAssignmentService
   */
  async rebalanceTeams(
    gameId: string,
    strategy: TeamFormationStrategy,
  ): Promise<Team[]> {
    return this.assignmentService.rebalanceTeams(gameId, strategy);
  }

  /**
   * Shuffle players randomly across existing teams
   * Delegated to TeamAssignmentService
   */
  async shufflePlayers(gameId: string): Promise<Team[]> {
    return this.assignmentService.shufflePlayers(gameId);
  }

  /**
   * Swap a player from one team to another
   * Delegated to TeamAssignmentService
   */
  async swapPlayerToTeam(
    playerId: string,
    fromTeamId: string,
    toTeamId: string,
  ): Promise<{ fromTeam: Team; toTeam: Team }> {
    return this.assignmentService.swapPlayerToTeam(
      playerId,
      fromTeamId,
      toTeamId,
    );
  }

  /**
   * Dissolve a team and return its players to the unassigned pool
   * Delegated to TeamAssignmentService
   */
  async dissolveTeam(teamId: string): Promise<void> {
    return this.assignmentService.dissolveTeam(teamId);
  }

  /**
   * Reassign a player to a different team (removes from current team if any)
   * Delegated to TeamAssignmentService
   */
  async reassignPlayer(playerId: string, newTeamId: string): Promise<Team> {
    return this.assignmentService.reassignPlayer(playerId, newTeamId);
  }
}
