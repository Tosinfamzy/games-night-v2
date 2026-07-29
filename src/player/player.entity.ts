import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  ManyToMany,
  OneToMany,
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
// At most one player per (session, name): closes the joinSession check-then-
// create race at the DB level. See migration AddUniquePlayerNamePerSession.
@Index('UQ_player_session_name', ['session', 'name'], { unique: true })
export class Player {
  @ApiProperty({ example: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Bob' })
  @Column()
  name: string;

  @ApiProperty({
    example: false,
    description:
      'Whether this is a guest player (not linked to a user account)',
  })
  @Column({ default: false })
  isGuest: boolean;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Linked user ID (if authenticated)',
    required: false,
  })
  @Column({ nullable: true })
  userId?: string;

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

  @ApiProperty({
    example: true,
    description: 'Whether the player is currently online (WebSocket connected)',
  })
  @Column({ default: false })
  isOnline: boolean;

  @ApiProperty({
    example: 'socket-abc123',
    description: 'Current WebSocket connection ID',
    required: false,
  })
  @Index()
  @Column({ nullable: true })
  currentSocketId?: string;

  @ApiProperty({ type: () => Session })
  @Index()
  // CASCADE: deleting a session removes its players.
  @ManyToOne(() => Session, (session) => session.players, {
    eager: true,
    onDelete: 'CASCADE',
  })
  session: Session;

  @ApiProperty({ type: () => [Team] })
  // Inverse side of Team.players (the owning @JoinTable is on Team). Previously
  // this also had @JoinTable, creating a second, always-empty join table
  // (player_teams_team) and leaving player.teams unreadable.
  @ManyToMany(() => Team, (team) => team.players)
  teams: Team[];

  @ApiProperty({ type: () => [Score] })
  @OneToMany(() => Score, (score) => score.player)
  scores: Score[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
