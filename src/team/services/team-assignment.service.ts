import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Team } from '../team.entity';
import { Game } from '../../game/game.entity';
import { Player } from '../../player/player.entity';
import { isActivePlayer } from '../../common/utils/player-status.util';
import { SessionGateway } from '../../session/session.gateway';
import {
  AssignPlayersDto,
  TeamFormationStrategy,
} from '../dto/team-formation.dto';
import { TeamFormationService } from './team-formation.service';

@Injectable()
export class TeamAssignmentService {
  constructor(
    @InjectRepository(Team)
    private readonly repo: Repository<Team>,
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @Inject(forwardRef(() => SessionGateway))
    private readonly sessionGateway: SessionGateway,
    @Inject(forwardRef(() => TeamFormationService))
    private readonly formationService: TeamFormationService,
  ) {}

  /**
   * Manually assign players to teams
   */
  async manualAssignPlayers(
    gameId: string,
    dto: AssignPlayersDto,
  ): Promise<Team[]> {
    const teams = await this.findByGame(gameId);
    const sessionId = teams[0]?.session?.id;

    for (const [teamId, playerIds] of Object.entries(dto.teamAssignments)) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) {
        throw new NotFoundException(`Team with ID ${teamId} not found`);
      }

      const players = await this.playerRepo.find({
        where: { id: In(playerIds) },
      });
      team.players = players;
      const savedTeam = await this.repo.save(team);

      // Broadcast player assignments and team update
      if (sessionId) {
        // Broadcast each player assignment
        for (const player of players) {
          this.sessionGateway.broadcastPlayerAssignedToTeam(
            sessionId,
            teamId,
            player.id,
          );
        }

        // Broadcast team updated
        this.sessionGateway.broadcastTeamUpdated(sessionId, savedTeam);
      }
    }

    return this.findByGame(gameId);
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

    const activePlayers = game.session.players.filter(isActivePlayer);

    // Clear current player assignments but keep teams
    for (const team of existingTeams) {
      team.players = [];
      await this.repo.save(team);
    }

    // Reassign players using new strategy
    await this.formationService.assignPlayersByStrategy(
      existingTeams,
      activePlayers,
      strategy,
    );

    return this.findByGame(gameId);
  }

  /**
   * Shuffle players randomly across existing teams
   */
  async shufflePlayers(gameId: string): Promise<Team[]> {
    const existingTeams = await this.findByGame(gameId);

    if (existingTeams.length === 0) {
      throw new BadRequestException('No teams found to shuffle');
    }

    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['session', 'session.players'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${gameId} not found`);
    }

    const activePlayers = game.session.players.filter(isActivePlayer);

    // Shuffle the players array
    const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);

    // Clear current player assignments but keep teams
    for (const team of existingTeams) {
      team.players = [];
      await this.repo.save(team);
    }

    // Distribute shuffled players evenly across teams
    const playersPerTeam = Math.floor(shuffled.length / existingTeams.length);
    const remainder = shuffled.length % existingTeams.length;

    let playerIndex = 0;
    for (let i = 0; i < existingTeams.length; i++) {
      const team = existingTeams[i];
      const teamSize = playersPerTeam + (i < remainder ? 1 : 0);

      team.players = shuffled.slice(playerIndex, playerIndex + teamSize);
      playerIndex += teamSize;

      await this.repo.save(team);
    }

    return this.findByGame(gameId);
  }

  /**
   * Swap a player from one team to another
   */
  async swapPlayerToTeam(
    playerId: string,
    fromTeamId: string,
    toTeamId: string,
  ): Promise<{ fromTeam: Team; toTeam: Team }> {
    // Validate teams exist
    const fromTeam = await this.findOne(fromTeamId, [
      'players',
      'game',
      'session',
    ]);
    const toTeam = await this.findOne(toTeamId, ['players', 'game', 'session']);

    // Ensure both teams belong to the same game
    if (fromTeam.game.id !== toTeam.game.id) {
      throw new BadRequestException(
        'Cannot swap players between teams from different games',
      );
    }

    // Find the player
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    // Check if player is in the source team
    const playerInFromTeam = fromTeam.players.some((p) => p.id === playerId);
    if (!playerInFromTeam) {
      throw new BadRequestException(
        `Player ${player.name} is not in team ${fromTeam.name}`,
      );
    }

    // Remove player from source team
    fromTeam.players = fromTeam.players.filter((p) => p.id !== playerId);

    // Add player to destination team
    toTeam.players.push(player);

    // Save both teams
    const savedFromTeam = await this.repo.save(fromTeam);
    const savedToTeam = await this.repo.save(toTeam);

    // Broadcast updates
    const sessionId = fromTeam.session?.id;
    if (sessionId) {
      this.sessionGateway.broadcastTeamUpdated(sessionId, savedFromTeam);
      this.sessionGateway.broadcastTeamUpdated(sessionId, savedToTeam);
      this.sessionGateway.broadcastPlayerAssignedToTeam(
        sessionId,
        toTeamId,
        playerId,
      );
    }

    return {
      fromTeam: savedFromTeam,
      toTeam: savedToTeam,
    };
  }

  /**
   * Dissolve a team and return its players to the unassigned pool
   */
  async dissolveTeam(teamId: string): Promise<void> {
    const team = await this.findOne(teamId, [
      'players',
      'game',
      'game.session',
      'session',
    ]);

    const sessionId = team.session?.id || team.game?.session?.id;
    const playerIds = team.players.map((p) => p.id);

    // Remove the team (this unassigns all players)
    await this.repo.remove(team);

    // Broadcast events
    if (sessionId) {
      this.sessionGateway.broadcastTeamDeleted(sessionId, teamId);

      // Notify that players are now unassigned
      for (const playerId of playerIds) {
        this.sessionGateway.server
          .to(`session:${sessionId}`)
          .emit('team:player-unassigned', {
            sessionId,
            playerId,
            teamId,
            message: `Player unassigned from dissolved team ${team.name}`,
          });
      }
    }
  }

  /**
   * Reassign a player to a different team (removes from current team if any)
   */
  async reassignPlayer(playerId: string, newTeamId: string): Promise<Team> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
      relations: ['teams', 'teams.game', 'teams.session'],
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    const newTeam = await this.findOne(newTeamId, [
      'players',
      'game',
      'session',
    ]);

    // Find player's current team (if any) in the same game
    const currentTeamInSameGame = player.teams?.find(
      (t) => t.game.id === newTeam.game.id,
    );

    // Remove from current team if exists
    if (currentTeamInSameGame) {
      currentTeamInSameGame.players = currentTeamInSameGame.players.filter(
        (p) => p.id !== playerId,
      );
      await this.repo.save(currentTeamInSameGame);

      // Broadcast update for old team
      const sessionId =
        currentTeamInSameGame.session?.id ||
        currentTeamInSameGame.game?.session?.id;
      if (sessionId) {
        this.sessionGateway.broadcastTeamUpdated(
          sessionId,
          currentTeamInSameGame,
        );
      }
    }

    // Add to new team
    newTeam.players.push(player);
    const savedTeam = await this.repo.save(newTeam);

    // Broadcast updates
    const sessionId = newTeam.session?.id || newTeam.game?.session?.id;
    if (sessionId) {
      this.sessionGateway.broadcastTeamUpdated(sessionId, savedTeam);
      this.sessionGateway.broadcastPlayerAssignedToTeam(
        sessionId,
        newTeamId,
        playerId,
      );
    }

    return savedTeam;
  }

  /**
   * Helper: Find teams by game
   */
  private async findByGame(gameId: string): Promise<Team[]> {
    return this.repo.find({
      where: { game: { id: gameId } },
      order: { name: 'ASC' },
      relations: ['game', 'players', 'session', 'scores'],
    });
  }

  /**
   * Helper: Find a team by ID
   */
  private async findOne(id: string, relations: string[] = []): Promise<Team> {
    const team = await this.repo.findOne({
      where: { id },
      relations,
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }
}
