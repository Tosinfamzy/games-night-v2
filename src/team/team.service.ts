import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.repo.find({
      relations,
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
      relations: ['game', 'players'],
    });
  }

  async createTeamsForGame(
    gameId: string,
    dto: CreateTeamsDto,
  ): Promise<Team[]> {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session', 'session.players'],
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

    // Assign players based on strategy
    await this.assignPlayersByStrategy(teams, activePlayers, dto.strategy);

    return this.repo.find({
      where: { game: { id: gameId } },
      relations: ['players'],
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
    // For balanced assignment, we could implement skill-based balancing
    // For now, we'll use round-robin distribution
    return this.automaticAssignment(teamCount, players);
  }

  private automaticAssignment(
    teamCount: number,
    players: Player[],
  ): Player[][] {
    const assignments: Player[][] = Array.from({ length: teamCount }, () => []);

    players.forEach((player, index) => {
      assignments[index % teamCount].push(player);
    });

    return assignments;
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

      const players = await this.playerRepo.findByIds(playerIds);
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
}
