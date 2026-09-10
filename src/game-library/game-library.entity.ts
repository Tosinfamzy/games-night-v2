import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { GameFormat } from './enums/game-format.enum';

@Entity('game_library')
export class GameLibrary {
  @ApiProperty({ example: 'uuid', description: 'Game library ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Articulate', description: 'Name of the game' })
  @Column({ unique: true })
  name: string;

  @ApiProperty({
    example:
      'A fun word-guessing game where teams compete to describe words without saying them directly.',
    description: 'Description of the game',
  })
  @Column('text')
  description: string;

  @ApiProperty({
    example: 4,
    description: 'Minimum number of players required',
  })
  @Column()
  minPlayers: number;

  @ApiProperty({
    example: 12,
    description: 'Maximum number of players supported',
  })
  @Column()
  maxPlayers: number;

  @ApiProperty({
    example: 30,
    description: 'Estimated duration in minutes',
  })
  @Column()
  estimatedDuration: number;

  @ApiProperty({
    example: 'Easy',
    description: 'Difficulty level',
    enum: ['Easy', 'Medium', 'Hard'],
  })
  @Column({
    type: 'enum',
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy',
  })
  difficulty: 'Easy' | 'Medium' | 'Hard';

  @ApiProperty({
    example: ['Word Game', 'Team Game', 'Party Game'],
    description: 'Categories this game belongs to',
  })
  @Column('simple-array')
  categories: string[];

  @ApiProperty({
    example: 'Cards, Timer',
    description: 'Required equipment for the game',
    required: false,
  })
  @Column({ nullable: true })
  equipment?: string;

  @ApiProperty({
    example:
      'Teams take turns describing words while teammates guess. No rhyming, sounds-like, or direct translations allowed.',
    description: 'Brief rules summary',
    required: false,
  })
  @Column('text', { nullable: true })
  rules?: string;

  @ApiProperty({
    example: true,
    description: 'Whether this game is currently available for selection',
  })
  @Column({ default: true })
  isActive: boolean;

  // ── Night Builder planning metadata ──
  // How the game is run, and the defaults the planner suggests for it.

  @ApiProperty({
    enum: GameFormat,
    example: GameFormat.ALL_TEAMS,
    description: 'How the game is physically run on the night',
  })
  @Column({ type: 'varchar', default: GameFormat.ALL_TEAMS })
  format: GameFormat;

  @ApiProperty({
    example: 3,
    description: 'Suggested number of rounds/waves for this game',
  })
  @Column({ default: 1 })
  recommendedRounds: number;

  @ApiProperty({
    example: 6,
    description:
      'How many players participate at once (null = everyone plays together)',
    required: false,
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  playersPerRound?: number | null;

  @ApiProperty({
    example: 3,
    description:
      'Minimum number of teams this game needs (null = no special requirement)',
    required: false,
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  minTeams?: number | null;

  @ApiProperty({
    example: 5,
    description:
      'Flat points awarded to the winner instead of placement points (null = use placement points)',
    required: false,
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  winnerBonusPoints?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
