import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
import { Player, PlayerStatus } from '../player/player.entity';

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
  ) {}

  async create(dto: CreateTeamDto): Promise<Team> {
    const game = await this.gameRepo.findOneBy({ id: dto.gameId });
    if (!game) {
      throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
    }

    const team = this.repo.create({
      name: dto.name,
      game,
    });
    return await this.repo.save(team);
  }

  async findAll(relations: string[] = []): Promise<Team[]> {
    const defaultRelations = ['session', 'game', 'players', 'scores'];
    const mergedRelations = Array.from(new Set([...defaultRelations, ...relations]));
    return this.repo.find({
      relations: mergedRelations,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, relations: string[] = []): Promise<Team> {
    const team = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);

    if (dto.gameId) {
      const game = await this.gameRepo.findOneBy({ id: dto.gameId });
      if (!game) {
        throw new NotFoundException(`Game with ID ${dto.gameId} not found`);
      }
      team.game = game;
    }

    Object.assign(team, {
      name: dto.name ?? team.name,
    });

    return await this.repo.save(team);
  }

  async delete(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.repo.remove(team);
  }

  async findByGame(gameId: string): Promise<Team[]> {
    return this.repo.find({
      where: { game: { id: gameId } },
      order: { name: 'ASC' },
      relations: ['game', 'players', 'session', 'scores'],
    });
  }

  async createTeamsForGame(
    gameId: string,
    dto: CreateTeamsDto,
  ): Promise<Team[]> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session', 'session.players', 'gameLibrary'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    // Get active players in the session
    const activePlayers = game.session.players.filter(
      (player) => player.status === PlayerStatus.PLAYING,
    );

    if (activePlayers.length === 0) {
      throw new BadRequestException(
        'No active players found for team formation',
      );
    }

    // Validate team formation against game requirements
    const validationResult = this.validateTeamFormation(
      activePlayers.length,
      dto.teamCount,
      game.gameLibrary,
    );

    if (!validationResult.isValid) {
      throw new BadRequestException(
        `Team formation validation failed: ${validationResult.errors.join(', ')}`,
      );
    }

    // Clear existing teams for this game
    await this.clearTeamsForGame(gameId);

    // Generate team names and colors
    const teamNames = this.generateTeamNames(dto.teamCount, dto.teamNames);
    const teamColors = this.generateTeamColors(dto.teamCount, dto.teamColors);

    // Create teams
    const teams: Team[] = [];
    for (let i = 0; i < dto.teamCount; i++) {
      const team = this.repo.create({
        name: teamNames[i],
        color: teamColors[i],
        position: i + 1,
        game,
        session: game.session,
        players: [],
      });
      teams.push(await this.repo.save(team));
    }

    // Assign players based on strategy with improved algorithms
    await this.assignPlayersByStrategy(teams, activePlayers, dto.strategy);

    return this.repo.find({
      where: { game: { id: gameId } },
      relations: ['players', 'session', 'scores', 'game'],
      order: { position: 'ASC' },
    });
  }

  async clearTeamsForGame(gameId: string): Promise<void> {
    const existingTeams = await this.findByGame(gameId);
    if (existingTeams.length > 0) {
      await this.repo.remove(existingTeams);
    }
  }

  private generateTeamNames(count: number, customNames?: string[]): string[] {
    const defaultNames = [
      'Team Alpha',
      'Team Beta',
      'Team Gamma',
      'Team Delta',
      'Team Epsilon',
      'Team Zeta',
      'Team Eta',
      'Team Theta',
    ];

    if (customNames && customNames.length >= count) {
      return customNames.slice(0, count);
    }

    return defaultNames.slice(0, count);
  }

  private generateTeamColors(count: number, customColors?: string[]): string[] {
    const defaultColors = [
      '#FF5733',
      '#3366FF',
      '#28A745',
      '#FFC107',
      '#6F42C1',
      '#FD7E14',
      '#20C997',
      '#E83E8C',
    ];

    if (customColors && customColors.length >= count) {
      return customColors.slice(0, count);
    }

    return defaultColors.slice(0, count);
  }

  private async assignPlayersByStrategy(
    teams: Team[],
    players: Player[],
    strategy: TeamFormationStrategy,
  ): Promise<void> {
    let assignments: Player[][];

    switch (strategy) {
      case TeamFormationStrategy.RANDOM:
        assignments = this.randomAssignment(teams.length, players);
        break;
      case TeamFormationStrategy.BALANCED:
        assignments = this.balancedAssignment(teams.length, players);
        break;
      case TeamFormationStrategy.AUTOMATIC:
      default:
        assignments = this.automaticAssignment(teams.length, players);
        break;
    }

    // Save team assignments
    for (let i = 0; i < teams.length; i++) {
      teams[i].players = assignments[i];
      await this.repo.save(teams[i]);
    }
  }

  private randomAssignment(teamCount: number, players: Player[]): Player[][] {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const assignments: Player[][] = Array.from({ length: teamCount }, () => []);

    shuffled.forEach((player, index) => {
      assignments[index % teamCount].push(player);
    });

    return assignments;
  }

  private balancedAssignment(teamCount: number, players: Player[]): Player[][] {
    // Enhanced balanced assignment with skill-based balancing
    const assignments: Player[][] = Array.from({ length: teamCount }, () => []);

    // Sort players by experience/skill level (using creation time as proxy for now)
    // In a real implementation, you'd have player skill ratings
    const sortedPlayers = [...players].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Snake draft assignment (1st pick to last, then last to 1st)
    let currentTeam = 0;
    let direction = 1;

    for (const player of sortedPlayers) {
      assignments[currentTeam].push(player);

      if (direction === 1 && currentTeam === teamCount - 1) {
        direction = -1;
      } else if (direction === -1 && currentTeam === 0) {
        direction = 1;
      } else {
        currentTeam += direction;
      }
    }

    return assignments;
  }

  private automaticAssignment(
    teamCount: number,
    players: Player[],
  ): Player[][] {
    // Improved automatic assignment with better distribution
    const assignments: Player[][] = Array.from({ length: teamCount }, () => []);

    // Shuffle players for fairness
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    shuffledPlayers.forEach((player, index) => {
      assignments[index % teamCount].push(player);
    });

    return assignments;
  }

  /**
   * Validates team formation against game requirements
   */
  private validateTeamFormation(
    playerCount: number,
    teamCount: number,
    gameLibrary: { minPlayers?: number; maxPlayers?: number } | null,
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate minimum/maximum teams
    if (teamCount < 2) {
      errors.push('At least 2 teams are required');
    }

    if (teamCount > 8) {
      errors.push('Maximum 8 teams allowed');
    }

    // Validate players per team
    const playersPerTeam = Math.floor(playerCount / teamCount);
    const remainder = playerCount % teamCount;

    if (playersPerTeam === 0) {
      errors.push(`Not enough players (${playerCount}) for ${teamCount} teams`);
    }

    // Game-specific validations
    if (gameLibrary) {
      const { minPlayers, maxPlayers } = gameLibrary;

      if (minPlayers && playerCount < minPlayers) {
        errors.push(
          `Game requires at least ${minPlayers} players, but only ${playerCount} available`,
        );
      }

      if (maxPlayers && playerCount > maxPlayers) {
        errors.push(
          `Game supports maximum ${maxPlayers} players, but ${playerCount} available`,
        );
      }

      // Team size recommendations
      const idealPlayersPerTeam = Math.ceil(playerCount / teamCount);
      if (idealPlayersPerTeam > 6) {
        warnings.push(
          `Teams will be large (${idealPlayersPerTeam} players each). Consider more teams.`,
        );
      }

      if (idealPlayersPerTeam < 2) {
        warnings.push(
          `Teams will be small (${idealPlayersPerTeam} players each). Consider fewer teams.`,
        );
      }
    }

    // Uneven team distribution warning
    if (remainder > 0) {
      warnings.push(
        `Teams will be uneven: ${teamCount - remainder} teams with ${playersPerTeam} players, ${remainder} teams with ${playersPerTeam + 1} players`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async manualAssignPlayers(
    gameId: string,
    dto: AssignPlayersDto,
  ): Promise<Team[]> {
    const teams = await this.findByGame(gameId);

    for (const [teamId, playerIds] of Object.entries(dto.teamAssignments)) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) {
        throw new NotFoundException(`Team with ID ${teamId} not found`);
      }

      const players = await this.playerRepo.find({
        where: { id: In(playerIds) },
      });
      team.players = players;
      await this.repo.save(team);
    }

    return this.findByGame(gameId);
  }

  async getTeamStats(gameId: string) {
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
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session', 'session.players', 'gameLibrary'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    const activePlayers = game.session.players.filter(
      (player) => player.status === PlayerStatus.PLAYING,
    );

    const playerCount = activePlayers.length;
    const suggestions: Array<{
      teamCount: number;
      strategy: TeamFormationStrategy;
      playersPerTeam: number;
      remainder: number;
      pros: string[];
      cons: string[];
    }> = [];

    // Generate suggestions for different team counts
    for (
      let teamCount = 2;
      teamCount <= Math.min(playerCount, 6);
      teamCount++
    ) {
      const playersPerTeam = Math.floor(playerCount / teamCount);
      const remainder = playerCount % teamCount;

      if (playersPerTeam === 0) continue;

      const pros: string[] = [];
      const cons: string[] = [];

      // Analyze pros and cons
      if (playersPerTeam >= 2 && playersPerTeam <= 4) {
        pros.push('Optimal team size for collaboration');
      }
      if (remainder === 0) {
        pros.push('Even team distribution');
      }
      if (teamCount === 2) {
        pros.push('Simple team dynamics');
      }
      if (teamCount >= 3) {
        pros.push('More competitive variety');
      }

      if (playersPerTeam > 6) {
        cons.push('Teams might be too large');
      }
      if (playersPerTeam < 2) {
        cons.push('Teams might be too small');
      }
      if (remainder > teamCount / 2) {
        cons.push('Significantly uneven teams');
      }

      suggestions.push({
        teamCount,
        strategy:
          teamCount <= 3
            ? TeamFormationStrategy.BALANCED
            : TeamFormationStrategy.RANDOM,
        playersPerTeam,
        remainder,
        pros,
        cons,
      });
    }

    const defaultTeamCount =
      suggestions.length > 0 ? suggestions[0].teamCount : 2;

    return {
      suggestions,
      validation: this.validateTeamFormation(
        playerCount,
        defaultTeamCount,
        game.gameLibrary,
      ),
    };
  }

  /**
   * Rebalances existing teams using a different strategy
   */
  async rebalanceTeams(
    gameId: string,
    strategy: TeamFormationStrategy,
  ): Promise<Team[]> {
    const existingTeams = await this.findByGame(gameId);

    if (existingTeams.length === 0) {
      throw new BadRequestException('No teams found to rebalance');
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session', 'session.players'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    const activePlayers = game.session.players.filter(
      (player) => player.status === PlayerStatus.PLAYING,
    );

    // Clear current player assignments but keep teams
    for (const team of existingTeams) {
      team.players = [];
      await this.repo.save(team);
    }

    // Reassign players using new strategy
    await this.assignPlayersByStrategy(existingTeams, activePlayers, strategy);

    return this.findByGame(gameId);
  }
}
