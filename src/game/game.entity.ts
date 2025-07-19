import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
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
    example: 'uuid',
    description: 'ID of the team whose turn it is',
    required: false,
  })
  @Column({ nullable: true })
  currentTurnTeamId?: string;

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
    description: 'Session this game belongs to',
    type: () => Session,
  })
  @ManyToOne(() => Session, (session) => session.games, { eager: true })
  session: Session;

  @ApiProperty({
    description: 'Game template from the library this game is based on',
    type: () => GameLibrary,
  })
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
