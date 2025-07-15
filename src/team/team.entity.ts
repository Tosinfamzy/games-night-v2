import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Game } from '../game/game.entity';
import { Player } from '../player/player.entity';
import { Score } from '../score/score.entity';
import { Session } from '../session/session.entity';

@Entity()
export class Team {
  @ApiProperty({ example: 'uuid', description: 'Team ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Team A', description: 'Name of the team' })
  @Column()
  name: string;

  @ApiProperty({ type: () => Game, description: 'Game this team belongs to' })
  @ManyToOne(() => Game, (game) => game.teams, { eager: true })
  game: Game;

  @ApiProperty({
    type: () => Session,
    description: 'Session this team belongs to',
  })
  @ManyToOne(() => Session, (session) => session.teams, { eager: true })
  session: Session;

  @ApiProperty({ type: () => [Player], description: 'Players in this team' })
  @ManyToMany(() => Player, (player) => player.teams, { eager: true })
  @JoinTable()
  players: Player[];

  @ApiProperty({ type: () => [Score], description: 'Scores for this team' })
  @OneToMany(() => Score, (score) => score.team)
  scores: Score[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
