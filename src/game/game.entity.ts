import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Score } from '../score/score.entity';
import { GameLibrary } from '../game-library/game-library.entity';
import { GameStatus } from './enums/game-status.enum';
import { ScoreMode } from './enums/score-mode.enum';

export interface GameResults {
  standings: Array<{
    teamId: string;
    teamName: string;
    rank: number;
    totalPoints: number;
  }>;
  winningScore: number | null;
  isTied: boolean;
  completedAt?: string;
}

@Entity()
export class Game {
  @ApiProperty({ example: 'uuid', description: 'Game ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Chess', description: 'Name of the game' })
  @Column()
  name: string;

  @ApiProperty({
    enum: GameStatus,
    default: GameStatus.PENDING,
    description: 'Current status of the game',
  })
  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.PENDING,
  })
  status: GameStatus;

  @ApiProperty({
    enum: GameStatus,
    required: false,
    description:
      'Status the game held before it was paused, so resume can restore the ' +
      'exact prior state (e.g. mid-round vs between-rounds).',
  })
  // Plain varchar (not a DB enum): it only ever holds a GameStatus string, and
  // a dedicated enum type would add a second Postgres type that parallel test
  // workers race to CREATE. varchar avoids that with no loss of correctness.
  @Column({ type: 'varchar', nullable: true })
  statusBeforePause?: GameStatus;

  @ApiProperty({
    example: 1,
    description: 'Current round number',
    default: 0,
  })
  @Column({ default: 0 })
  currentRound: number;

  @ApiProperty({
    example: 3,
    description: 'Maximum number of rounds',
    default: 1,
  })
  @Column({ default: 1 })
  maxRounds: number;

  @ApiProperty({
    enum: ScoreMode,
    default: ScoreMode.TEAM,
    description:
      'Whether the game is scored by team or by individual player. ' +
      'Individual mode lets a 1-v-1 game skip building one-person teams.',
  })
  // Plain varchar (not a DB enum) for the same reason as statusBeforePause —
  // avoids a second Postgres enum type that parallel test workers race to create.
  @Column({ type: 'varchar', default: ScoreMode.TEAM })
  scoreMode: ScoreMode;

  @ApiProperty({
    example: 'uuid',
    description: 'ID of the team whose turn it is',
    required: false,
  })
  @Column({ nullable: true })
  currentTurnTeamId?: string;

  @ApiProperty({
    example: 'uuid',
    description: 'ID of the player whose turn it is (individual mode)',
    required: false,
  })
  @Column({ nullable: true })
  currentTurnPlayerId?: string;

  @ApiProperty({
    example: '2025-01-15T10:30:00Z',
    description: 'When the current turn started',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  turnStartedAt?: Date;

  @ApiProperty({
    example: 120,
    description: 'Turn time limit in seconds',
    required: false,
  })
  @Column({ nullable: true })
  turnTimeLimit?: number;

  @ApiProperty({
    example: 'team-uuid-123',
    description: 'ID of the winning team',
    required: false,
  })
  @Column({ nullable: true })
  winnerId?: string;

  @ApiProperty({
    example: '2025-01-15T14:30:00Z',
    description: 'When the game was completed',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @ApiProperty({
    example: {
      standings: [],
      winningScore: 450,
      isTied: false,
    },
    description: 'Final game results stored as JSON',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  results?: GameResults;

  @ApiProperty({
    description: 'Session this game belongs to',
    type: () => Session,
  })
  @Index()
  // CASCADE: deleting a session removes its games (which in turn cascade to
  // scores/teams/results). Without this, deleting any non-empty session 500s.
  @ManyToOne(() => Session, (session) => session.games, {
    eager: true,
    onDelete: 'CASCADE',
  })
  session: Session;

  @ApiProperty({
    description: 'Game template from the library this game is based on',
    type: () => GameLibrary,
  })
  @Index()
  @ManyToOne(() => GameLibrary, { eager: true })
  gameLibrary: GameLibrary;

  @ApiProperty({ type: () => [Team], description: 'Teams for this game' })
  @OneToMany(() => Team, (team) => team.game)
  teams: Team[];

  @ApiProperty({
    type: () => [Score],
    description: 'Scores recorded for this game',
  })
  @OneToMany(() => Score, (score) => score.game)
  scores: Score[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
