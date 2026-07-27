import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InviteService, InviteSummary } from './invite.service';
import { Invite } from './invite.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { PublicRsvpDto } from './dto/public-rsvp.dto';
import { PublicRsvpViewDto } from './dto/public-rsvp-view.dto';
import { PublicInviteDto } from './dto/public-invite.dto';

@ApiTags('invite')
@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // ----- Games-master guest-list management (session-scoped) -----

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a guest to a session guest list' })
  @Post('sessions/:sessionId/invites')
  create(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<Invite> {
    return this.inviteService.createForSession(sessionId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List a session guest list' })
  @Get('sessions/:sessionId/invites')
  list(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<Invite[]> {
    return this.inviteService.findBySession(sessionId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'RSVP tallies for a session' })
  @Get('sessions/:sessionId/invites/summary')
  summary(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<InviteSummary> {
    return this.inviteService.summary(sessionId);
  }

  @ApiBearerAuth()
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
    return this.inviteService
      .selfRsvp(rsvpToken, dto)
      .then((invite) => PublicInviteDto.fromEntity(invite));
  }
}
