import { DeepPartial } from 'typeorm';
import { Game } from '../game.entity';
import { GameStatus } from '../enums/game-status.enum';
import { GameLibrary } from '../../game-library/game-library.entity';

export type CreateGameRelations = DeepPartial<Pick<Game, 'session'>>;

export interface CreateGameInput {
  name: string;
  session: CreateGameRelations['session'];
}

/**
 * Player info within team stats
 */
export interface TeamPlayerStats {
  id: string;
  name: string;
  status: string;
}

/**
 * Team statistics returned by getTeamStats
 */
export interface TeamStats {
  id: string;
  name: string;
  color?: string;
  position: number;
  playerCount: number;
  players: TeamPlayerStats[];
}

/**
 * Current turn information
 */
export interface CurrentTurnInfo {
  teamId: string;
  teamName: string;
  teamColor?: string;
  duration: number;
  timeLimit: number | null | undefined;
}

/**
 * Comprehensive game statistics
 */
export interface GameStats {
  gameId: string;
  gameName: string;
  status: GameStatus;
  currentRound: number;
  maxRounds: number;
  teamsCount: number;
  totalPlayers: number;
  currentTurn: CurrentTurnInfo | null;
  teams: TeamStats[];
  gameLibrary: GameLibrary | null;
}
