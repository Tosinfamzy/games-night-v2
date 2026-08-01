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
import { Invite } from '../invite/invite.entity';
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
    description:
      'Public token powering the single shareable RSVP link (anyone can self-RSVP). Separate from joinCode so it can be revoked/regenerated independently.',
    example: 'uuid',
  })
  @Column({ type: 'uuid', unique: true })
  publicRsvpToken: string;

  @ApiProperty({
    description:
      'Host-authored invite message. Doubles as the default share text for the RSVP link and the greeting shown on the public RSVP page.',
    example: "You're invited! Bring snacks and your A-game 🎲",
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  inviteMessage?: string;

  @ApiProperty({
    description:
      "Host-authored info shown to guests once they've joined (on the night) — " +
      'e.g. WiFi details, house rules, "snacks in the kitchen". Distinct from ' +
      'inviteMessage, which is the pre-event RSVP greeting.',
    example: 'WiFi: GamesNight / pw: rolldice20 🎲 Snacks in the kitchen!',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  hostMessage?: string;

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

  @ApiProperty({
    type: () => [Invite],
    description: 'Invited guests / RSVPs for this session',
  })
  @OneToMany(() => Invite, (invite) => invite.session)
  invites: Invite[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
