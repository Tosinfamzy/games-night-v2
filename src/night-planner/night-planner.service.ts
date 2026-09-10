import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { GameLibrary } from '../game-library/game-library.entity';
import { Session } from '../session/session.entity';
import { SessionStatus } from '../session/enums/session-status.enum';
import { SessionService } from '../session/session.service';
import { Game } from '../game/game.entity';
import { GameStatus } from '../game/enums/game-status.enum';
import { ScoreMode } from '../game/enums/score-mode.enum';
import { Team } from '../team/team.entity';
import { DEFAULT_TEAM_COLORS, DEFAULT_TEAM_NAMES } from '../common/constants';
import { SuggestPlanDto } from './dto/suggest-plan.dto';
import { ApplyNightPlanDto } from './dto/apply-night-plan.dto';
import {
  NightPlanSuggestionDto,
  PlanGameSuggestionDto,
} from './dto/night-plan-suggestion.dto';
import {
  buildTimeline,
  formatLabel,
  scoringLabel,
  segmentMinutes,
  splitEvenly,
  suggestTeamCount,
} from './night-planner.util';

/**
 * Orchestrates the Night Builder: computes a tailored plan suggestion from the
 * game library and headcount, and applies a chosen plan onto a session. It is a
 * pure consumer of the library / session / team modules — no new circular deps.
 */
@Injectable()
export class NightPlannerService {
  constructor(
    @InjectRepository(GameLibrary)
    private readonly gameLibraryRepo: Repository<GameLibrary>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly sessionService: SessionService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Suggest a tailored plan (rounds, timing, team split) for the selected games
   * at the given headcount. Missing/inactive games are skipped with a warning
   * rather than failing — this is advisory, not a mutation.
   */
  async suggestPlan(dto: SuggestPlanDto): Promise<NightPlanSuggestionDto> {
    const requestedIds = [...new Set(dto.gameLibraryIds)];
    const found = await this.gameLibraryRepo.find({
      where: { id: In(requestedIds), isActive: true },
    });
    const byId = new Map(found.map((lib) => [lib.id, lib]));

    // Preserve the caller's ordering; drop (and warn about) anything missing.
    const ordered = requestedIds
      .map((id) => byId.get(id))
      .filter((lib): lib is GameLibrary => lib != null);

    const games: PlanGameSuggestionDto[] = ordered.map((lib) => {
      const rounds = lib.recommendedRounds || 1;
      return {
        gameLibraryId: lib.id,
        name: lib.name,
        format: lib.format,
        formatLabel: formatLabel(lib.format),
        recommendedRounds: rounds,
        playersPerRound: lib.playersPerRound ?? null,
        minTeams: lib.minTeams ?? null,
        estimatedDuration: lib.estimatedDuration,
        segmentMinutes: segmentMinutes(lib.estimatedDuration, rounds, rounds),
        scoringLabel: scoringLabel(lib.winnerBonusPoints ?? null),
      };
    });

    const minTeamsRequired = ordered.reduce(
      (max, lib) => Math.max(max, lib.minTeams ?? 0),
      0,
    );
    const teamCount = suggestTeamCount(dto.playerCount, minTeamsRequired);
    const sizes = splitEvenly(dto.playerCount, teamCount);
    const timeline = buildTimeline(
      games.map((g) => ({
        gameLibraryId: g.gameLibraryId,
        name: g.name,
        minutes: g.segmentMinutes,
      })),
    );

    return {
      playerCount: dto.playerCount,
      teamSuggestion: { teamCount, sizes },
      games,
      timeline,
      warnings: this.buildWarnings(
        dto.playerCount,
        teamCount,
        minTeamsRequired,
        ordered,
        requestedIds.length - ordered.length,
      ),
    };
  }

  private buildWarnings(
    playerCount: number,
    teamCount: number,
    minTeamsRequired: number,
    games: GameLibrary[],
    droppedCount: number,
  ): string[] {
    const warnings: string[] = [];

    if (droppedCount > 0) {
      warnings.push(
        `${droppedCount} selected game(s) are unavailable and were skipped.`,
      );
    }

    if (playerCount === 0) {
      warnings.push('Add an expected headcount to size the teams.');
    } else if (playerCount < teamCount) {
      warnings.push(
        `Only ${playerCount} players for ${teamCount} teams — some teams would be empty.`,
      );
    }

    if (minTeamsRequired > teamCount) {
      warnings.push(
        `Some games need at least ${minTeamsRequired} teams, but only ${teamCount} are planned.`,
      );
    }

    // Per-game headcount fit (same spirit as SessionReadinessService, but on
    // the not-yet-persisted selection).
    for (const game of games) {
      if (playerCount > 0 && playerCount < game.minPlayers) {
        warnings.push(
          `${game.name} needs at least ${game.minPlayers} players (you have ${playerCount}).`,
        );
      }
      if (playerCount > game.maxPlayers) {
        warnings.push(
          `${game.name} supports up to ${game.maxPlayers} players (you have ${playerCount}).`,
        );
      }
    }

    return warnings;
  }

  /**
   * Apply a planned line-up onto a SCHEDULED session: replaces its games (in
   * run-of-show order, with per-game rounds/score mode) and creates the empty
   * teams (players are assigned on the night with the existing tools). All in a
   * transaction with a status re-check to stay safe under concurrent applies.
   */
  async applyPlan(sessionId: string, dto: ApplyNightPlanDto): Promise<Session> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['games', 'teams', 'teams.players'],
    });
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }
    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `A plan can only be applied to a scheduled session (current: ${session.status})`,
      );
    }

    const requestedIds = dto.games.map((g) => g.gameLibraryId);
    const uniqueIds = [...new Set(requestedIds)];
    if (uniqueIds.length !== requestedIds.length) {
      throw new BadRequestException('A game can only appear once in the plan');
    }

    const libraries = await this.gameLibraryRepo.find({
      where: { id: In(uniqueIds), isActive: true },
    });
    if (libraries.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more selected games are unavailable',
      );
    }
    const libById = new Map(libraries.map((lib) => [lib.id, lib]));

    const { count } = dto.teams;
    const names = this.resolveTeamNames(count, dto.teams.names);
    const colors = this.resolveTeamColors(count, dto.teams.colors);

    await this.dataSource.transaction(async (manager) => {
      // Re-check status inside the transaction: a concurrent start/cancel must
      // not race a plan apply.
      const fresh = await manager.findOne(Session, {
        where: { id: sessionId },
      });
      if (!fresh || fresh.status !== SessionStatus.SCHEDULED) {
        throw new BadRequestException(
          'Session is no longer scheduled — plan not applied',
        );
      }

      // Replace existing line-up. Remove teams first (entity remove clears the
      // join table), then games. Safe here because the session hasn't started.
      if (session.teams.length > 0) {
        await manager.remove(session.teams);
      }
      if (session.games.length > 0) {
        await manager.remove(session.games);
      }

      const games = dto.games.map((entry) => {
        const library = libById.get(entry.gameLibraryId)!;
        return manager.create(Game, {
          name: library.name,
          session,
          gameLibrary: library,
          status: GameStatus.PENDING,
          currentRound: 0,
          maxRounds: entry.maxRounds,
          scoreMode: entry.scoreMode ?? ScoreMode.TEAM,
          orderIndex: entry.orderIndex,
        });
      });
      await manager.save(games);

      // Session-scoped empty teams (game left null); players join them on the
      // night via the existing team tools.
      const teams = Array.from({ length: count }, (_, i) =>
        manager.create(Team, {
          name: names[i],
          color: colors[i],
          position: i + 1,
          session,
          players: [],
        }),
      );
      await manager.save(teams);
    });

    return this.sessionService.findOne(sessionId, [
      'host',
      'games',
      'games.gameLibrary',
      'teams',
      'teams.players',
      'players',
    ]);
  }

  private resolveTeamNames(count: number, custom?: string[]): string[] {
    if (custom && custom.length >= count) return custom.slice(0, count);
    return DEFAULT_TEAM_NAMES.slice(0, count);
  }

  private resolveTeamColors(count: number, custom?: string[]): string[] {
    if (custom && custom.length >= count) return custom.slice(0, count);
    return DEFAULT_TEAM_COLORS.slice(0, count);
  }
}
