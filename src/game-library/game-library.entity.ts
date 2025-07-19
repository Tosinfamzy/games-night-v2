import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
