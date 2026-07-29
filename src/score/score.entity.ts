import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Game } from '../game/game.entity';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';

@Entity()
export class Score {
  @ApiProperty({ example: 'uuid', description: 'Score ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 5, description: 'Points awarded' })
  @Column('int')
  points: number;

  @ApiProperty({
    example: false,
    description: 'Whether these points are bonus points',
  })
  @Column({ default: false })
  isBonus: boolean;

  @ApiProperty({
    example: 1,
    description: 'The round number this score was recorded in',
  })
  @Column({ default: 1 })
  roundNumber: number;

  @ApiProperty({
    description: 'Game associated with this score',
    type: () => Game,
  })
  @Index()
  // CASCADE: removing a game drops its scores instead of failing on the FK.
  @ManyToOne(() => Game, (game) => game.scores, {
    eager: true,
    onDelete: 'CASCADE',
  })
  game: Game;

  @ApiProperty({
    description: 'Player who earned this score',
    type: () => Player,
  })
  @Index()
  // SET NULL: removing a player keeps their team's score on the board.
  @ManyToOne(() => Player, (player) => player.scores, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  player?: Player;

  @ApiProperty({ description: 'Team who earned this score', type: () => Team })
  @Index()
  // CASCADE: removing a team (dissolve/clear/re-form) drops its scores instead
  // of failing on the FK. Kept in sync with the migration for prod.
  @ManyToOne(() => Team, (team) => team.scores, {
    nullable: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  team?: Team;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
