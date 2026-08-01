import { ApiProperty } from '@nestjs/swagger';
import { Invite } from '../invite.entity';
import { RsvpStatus } from '../enums/rsvp-status.enum';
import { SessionStatus } from '../../session/enums/session-status.enum';

/** Safe session projection for public invite responses (no joinCode, no
 * publicRsvpToken, no host code). Keeps `host.name` nested so the existing RSVP
 * page keeps rendering "Hosted by …" without a shape change. */
class PublicInviteSessionDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Friday Game Night' })
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-09-01T19:00:00Z' })
  date: Date;

  @ApiProperty({ nullable: true })
  location: string | null;

  @ApiProperty({
    enum: SessionStatus,
    description: 'Session status — lets a guest see if they can join yet.',
  })
  status: SessionStatus;

  @ApiProperty({ nullable: true, example: { name: 'Ada' } })
  host: { name: string } | null;
}

/**
 * Public-facing invite response returned by the no-auth RSVP endpoints. Never
 * exposes the session's joinCode / publicRsvpToken or the host's code — only the
 * guest's own invite data plus a safe event projection.
 */
export class PublicInviteDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Personal token for editing this RSVP later. Null on the open self-RSVP ' +
      'link response — that path must not hand a matched guest’s edit token to ' +
      'whoever submitted the form (they re-RSVP via the same link + email).',
  })
  inviteToken: string | null;

  @ApiProperty({ enum: RsvpStatus })
  rsvpStatus: RsvpStatus;

  @ApiProperty({ example: 0 })
  plusOnes: number;

  @ApiProperty({ nullable: true })
  note: string | null;

  @ApiProperty({ nullable: true })
  respondedAt: Date | null;

  @ApiProperty({ type: () => PublicInviteSessionDto, nullable: true })
  session: PublicInviteSessionDto | null;

  static fromEntity(
    invite: Invite,
    opts: { includeToken?: boolean } = {},
  ): PublicInviteDto {
    const { includeToken = true } = opts;
    const dto = new PublicInviteDto();
    dto.id = invite.id;
    dto.name = invite.name ?? null;
    dto.email = invite.email ?? null;
    dto.inviteToken = includeToken ? invite.inviteToken : null;
    dto.rsvpStatus = invite.rsvpStatus;
    dto.plusOnes = invite.plusOnes;
    dto.note = invite.note ?? null;
    dto.respondedAt = invite.respondedAt ?? null;
    dto.session = invite.session
      ? {
          id: invite.session.id,
          name: invite.session.name,
          description: invite.session.description ?? null,
          date: invite.session.date,
          location: invite.session.location ?? null,
          status: invite.session.status,
          host: invite.session.host ? { name: invite.session.host.name } : null,
        }
      : null;
    return dto;
  }
}
