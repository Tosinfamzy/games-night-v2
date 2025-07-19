import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Score } from '../score/score.entity';

export enum PlayerStatus {
  JOINED = 'joined',
  READY = 'ready',
  PLAYING = 'playing',
  DISCONNECTED = 'disconnected',
}

@Entity()
export class Player {
  @ApiProperty({ example: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Bob' })
  @Column()
  name: string;

  @ApiProperty({
    example: 'joined',
    description: 'Current status of the player',
    enum: PlayerStatus,
  })
  @Column({
    type: 'enum',
    enum: PlayerStatus,
    default: PlayerStatus.JOINED,
  })
  status: PlayerStatus;

  @ApiProperty({
    example: '2025-07-19T10:30:00Z',
    description: 'When the player last connected',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  lastConnectedAt?: Date;

  @ApiProperty({ type: () => Session })
  @ManyToOne(() => Session, (session) => session.players, { eager: true })
  session: Session;

  @ApiProperty({ type: () => [Team] })
  @ManyToMany(() => Team, (team) => team.players)
  @JoinTable()
  teams: Team[];

  @ApiProperty({ type: () => [Score] })
  @OneToMany(() => Score, (score) => score.player)
  scores: Score[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
