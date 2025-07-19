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
import { GamesMaster } from '../games-master/games-master.entity';
import { Game } from '../game/game.entity';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { SessionStatus } from './enums/session-status.enum';

@Entity()
export class Session {
  @ApiProperty({ example: 'uuid', description: 'Session ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Name of the session',
    example: 'Friday Game Night',
  })
  @Column()
  name: string;

  @ApiProperty({
    description: 'Description of the session',
    example: 'Weekly board game session',
    required: false,
  })
  @Column({ nullable: true })
  description?: string;

  @ApiProperty({
    description: 'Date of the session',
    example: '2025-07-14T19:00:00Z',
  })
  @Column('timestamptz')
  date: Date;

  @ApiProperty({
    description: 'Location of the session',
    example: 'Community Center',
    required: false,
  })
  @Column({ nullable: true })
  location?: string;

  @ApiProperty({
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
    description: 'Current status of the session',
  })
  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
  })
  status: SessionStatus;

  @ApiProperty({
    description: '6-digit join code for players to join the session',
    example: '123456',
  })
  @Column({ unique: true, length: 6 })
  joinCode: string;

  @ApiProperty({
    description: 'Games master hosting this session',
    type: () => GamesMaster,
  })
  @ManyToOne(() => GamesMaster, { eager: true })
  host: GamesMaster;

  @ApiProperty({
    type: () => [Game],
    description: 'Games scheduled in this session',
  })
  @OneToMany(() => Game, (game) => game.session)
  games: Game[];

  @ApiProperty({
    type: () => [Team],
    description: 'Teams in this session',
  })
  @OneToMany(() => Team, (team) => team.session)
  teams: Team[];

  @ApiProperty({
    type: () => [Player],
    description: 'Players in this session',
  })
  @OneToMany(() => Player, (player) => player.session)
  players: Player[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
