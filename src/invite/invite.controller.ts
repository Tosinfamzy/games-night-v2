import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HostGuard } from '../auth/guards/host.guard';
import { HostOf } from '../auth/decorators/host-of.decorator';
import { InviteService, InviteSummary } from './invite.service';
import { Invite } from './invite.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { PublicRsvpDto } from './dto/public-rsvp.dto';
import { PublicRsvpViewDto } from './dto/public-rsvp-view.dto';
import { PublicInviteDto } from './dto/public-invite.dto';
import { JoinViaInviteDto } from './dto/join-via-invite.dto';
import { SessionJoinResponseDto } from '../common/dto/session.response';

@ApiTags('invite')
// Host-guarded overall; the token-based public RSVP routes below opt out by
// simply not declaring @HostOf (HostGuard passes routes without it).
@UseGuards(HostGuard)
@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // ----- Games-master guest-list management (session-scoped, host only) -----

  @ApiBearerAuth()
  @HostOf('session', 'sessionId')
  @ApiOperation({ summary: 'Add a guest to a session guest list' })
  @Post('sessions/:sessionId/invites')
  create(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<Invite> {
    return this.inviteService.createForSession(sessionId, dto);
  }

  @ApiBearerAuth()
  @HostOf('session', 'sessionId')
  @ApiOperation({ summary: 'List a session guest list' })
  @Get('sessions/:sessionId/invites')
  list(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<Invite[]> {
    return this.inviteService.findBySession(sessionId);
  }

  @ApiBearerAuth()
  @HostOf('session', 'sessionId')
  @ApiOperation({ summary: 'RSVP tallies for a session' })
  @Get('sessions/:sessionId/invites/summary')
  summary(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<InviteSummary> {
    return this.inviteService.summary(sessionId);
  }

  @ApiBearerAuth()
  @HostOf('session', 'sessionId')
  @ApiOperation({ summary: 'Remove a guest from a session guest list' })
  @Delete('sessions/:sessionId/invites/:inviteId')
  remove(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<void> {
    return this.inviteService.remove(sessionId, inviteId);
  }

  // ----- Public RSVP (token-based, no auth) -----

  @ApiOperation({ summary: 'View an invite (with event details) by token' })
  @Get('invites/:token')
  view(@Param('token', ParseUUIDPipe) token: string): Promise<PublicInviteDto> {
    return this.inviteService
      .findByToken(token)
      .then((invite) => PublicInviteDto.fromEntity(invite));
  }

  @ApiOperation({ summary: 'Submit or update an RSVP by token' })
  @Post('invites/:token/rsvp')
  rsvp(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: RsvpDto,
  ): Promise<PublicInviteDto> {
    return this.inviteService
      .rsvp(token, dto)
      .then((invite) => PublicInviteDto.fromEntity(invite));
  }

  @ApiOperation({
    summary:
      'Join the live session straight from an invite link (no join code)',
  })
  @Post('invites/:token/join')
  joinViaInvite(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: JoinViaInviteDto,
  ): Promise<SessionJoinResponseDto> {
    return this.inviteService
      .joinViaInvite(token, dto.name)
      .then(({ session, player, message, playerToken }) =>
        SessionJoinResponseDto.fromEntities({
          session,
          playerId: player.id,
          playerName: player.name,
          message,
          playerToken,
        }),
      );
  }

  // ----- Open self-serve RSVP (single shareable session link, no auth) -----

  @ApiOperation({ summary: 'View an event by its shareable RSVP token' })
  @Get('rsvp/:rsvpToken')
  publicView(
    @Param('rsvpToken', ParseUUIDPipe) rsvpToken: string,
  ): Promise<PublicRsvpViewDto> {
    return this.inviteService.getPublicRsvpView(rsvpToken);
  }

  @ApiOperation({
    summary: 'Self-RSVP via the shareable link (creates/updates an invite)',
  })
  @Post('rsvp/:rsvpToken')
  selfRsvp(
    @Param('rsvpToken', ParseUUIDPipe) rsvpToken: string,
    @Body() dto: PublicRsvpDto,
  ): Promise<PublicInviteDto> {
    return this.inviteService.selfRsvp(rsvpToken, dto).then(
      // Echo the personal edit token only when THIS request created the invite
      // (a first-time RSVP) — so the guest gets their own bookmark/join link.
      // On an update to a matched invite we withhold it, so nobody can harvest
      // an existing guest's edit token by re-submitting their email/name.
      ({ invite, created }) =>
        PublicInviteDto.fromEntity(invite, { includeToken: created }),
    );
  }
}
