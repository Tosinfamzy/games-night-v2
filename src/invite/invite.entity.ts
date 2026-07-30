import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  RelationId,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../session/session.entity';
import { RsvpStatus } from './enums/rsvp-status.enum';

/**
 * A guest invited to a session. Distinct from Player: an invite may never turn
 * up (guest list / RSVP), whereas a Player has joined and can be on a team and
 * scored. When an invited guest actually joins, `playerId` links the two.
 */
@Entity('invite')
export class Invite {
  @ApiProperty({ example: 'uuid', description: 'Invite ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, (session) => session.invites, {
    onDelete: 'CASCADE',
  })
  @Index()
  session: Session;

  @ApiProperty({ description: 'Session this invite belongs to' })
  @RelationId((invite: Invite) => invite.session)
  sessionId: string;

  @ApiProperty({
    example: 'Ada Lovelace',
    description: 'Guest name (optional until they RSVP via an open link)',
    required: false,
  })
  @Column({ nullable: true })
  name?: string;

  @ApiProperty({
    example: 'ada@example.com',
    description: 'Guest email, for future delivery/reminders',
    required: false,
  })
  @Column({ nullable: true })
  email?: string;

  @ApiProperty({
    description: 'Unique token that powers the personal RSVP link',
  })
  @Column({ unique: true })
  inviteToken: string;

  @ApiProperty({ enum: RsvpStatus, description: 'RSVP state' })
  @Column({ type: 'enum', enum: RsvpStatus, default: RsvpStatus.PENDING })
  rsvpStatus: RsvpStatus;

  @ApiProperty({
    example: 0,
    description: 'Additional guests the invitee brings',
  })
  @Column({ type: 'int', default: 0 })
  plusOnes: number;

  @ApiProperty({ description: 'Optional note from the guest', required: false })
  @Column({ type: 'text', nullable: true })
  note?: string;

  @ApiProperty({
    description: 'Set to the Player id once the guest actually joins',
    required: false,
  })
  @Column({ type: 'uuid', nullable: true })
  playerId?: string;

  @ApiProperty({
    description: 'When the guest last responded',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  respondedAt?: Date;

  @ApiProperty({
    description: 'When the day-of reminder email was sent (null = not yet)',
    required: false,
  })
  @Column({ type: 'timestamptz', nullable: true })
  reminderSentAt?: Date;

  @ApiProperty({
    description:
      'When the "you haven\'t RSVP\'d yet" nudge was sent (null = not yet)',
    required: false,
  })
  @Column({ type: 'timestamptz', nullable: true })
  rsvpReminderSentAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
