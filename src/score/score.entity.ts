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
  @ManyToOne(() => Game, (game) => game.scores, { eager: true })
  game: Game;

  @ApiProperty({
    description: 'Player who earned this score',
    type: () => Player,
  })
  @ManyToOne(() => Player, (player) => player.scores, {
    nullable: true,
    eager: true,
  })
  player?: Player;

  @ApiProperty({ description: 'Team who earned this score', type: () => Team })
  @ManyToOne(() => Team, (team) => team.scores, { nullable: true, eager: true })
  team?: Team;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
