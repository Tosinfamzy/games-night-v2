import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../../session/enums/session-status.enum';

/**
 * Public, no-auth view of an event behind its shareable RSVP link. Deliberately
 * a narrow projection — it exposes just enough to render the RSVP page and NOT
 * the host's email, the join code, or the full guest list.
 */
export class PublicRsvpViewDto {
  @ApiProperty({ example: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 'Friday Game Night' })
  sessionName: string;

  @ApiProperty({
    enum: SessionStatus,
    example: SessionStatus.SCHEDULED,
    description:
      'Session lifecycle status, so the RSVP page can hide the form and ' +
      'show the right banner for a cancelled/finished/live event.',
  })
  status: SessionStatus;

  @ApiProperty({ example: '2025-07-14T19:00:00Z' })
  date: Date;

  @ApiProperty({ example: 'Community Center', nullable: true })
  location: string | null;

  @ApiProperty({ example: 'Weekly board game meetup', nullable: true })
  description: string | null;

  @ApiProperty({
    description: "The host's invite message, shown as a greeting on the page.",
    example: "You're invited! Bring snacks and your A-game 🎲",
    nullable: true,
  })
  inviteMessage: string | null;

  @ApiProperty({ example: 'Ada', nullable: true })
  hostName: string | null;

  @ApiProperty({
    example: 8,
    description: 'People marked going, incl. plus-ones',
  })
  goingHeadcount: number;
}
