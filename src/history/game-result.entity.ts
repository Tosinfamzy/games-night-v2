import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';

export interface FinalScore {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

@Entity()
export class GameResult {
  @ApiProperty({ example: 'uuid', description: 'Game result ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Game this result belongs to',
    type: () => Game,
  })
  @ManyToOne(() => Game, { eager: true })
  game: Game;

  @ApiProperty({
    description: 'Session this game was played in',
    type: () => Session,
  })
  @ManyToOne(() => Session, { eager: true })
  session: Session;

  @ApiProperty({
    example: 'Chess',
    description: 'Name of the game (denormalized for faster queries)',
  })
  @Column()
  gameName: string;

  @ApiProperty({
    description: 'Winning team',
    type: () => Team,
    required: false,
  })
  @ManyToOne(() => Team, { eager: true, nullable: true })
  winningTeam?: Team;

  @ApiProperty({
    example: 'Team A',
    description: 'Name of the winning team (denormalized)',
    required: false,
  })
  @Column({ nullable: true })
  winningTeamName?: string;

  @ApiProperty({
    example: [
      { teamId: 'uuid-1', teamName: 'Team A', score: 100, rank: 1 },
      { teamId: 'uuid-2', teamName: 'Team B', score: 85, rank: 2 },
    ],
    description: 'Final scores for all teams',
  })
  @Column({ type: 'jsonb' })
  finalScores: FinalScore[];

  @ApiProperty({
    example: '2025-12-14T15:30:00Z',
    description: 'When the game was completed',
  })
  @Column({ type: 'timestamp' })
  completedAt: Date;

  @ApiProperty({
    example: 45,
    description: 'Duration of the game in minutes',
  })
  @Column('int')
  durationMinutes: number;

  @ApiProperty({
    example: 3,
    description: 'Number of rounds played',
  })
  @Column('int')
  totalRounds: number;

  @ApiProperty({
    example: 4,
    description: 'Number of teams that participated',
  })
  @Column('int')
  teamCount: number;

  @ApiProperty({
    example: false,
    description: 'Whether the game ended in a tie',
  })
  @Column({ default: false })
  isTied: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
