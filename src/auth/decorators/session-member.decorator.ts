import { SetMetadata } from '@nestjs/common';
import { HostResource, HostOfMeta } from './host-of.decorator';

export const SESSION_MEMBER_KEY = 'sessionMember';

/**
 * Marks a session-scoped READ as members-only. SessionMemberGuard resolves the
 * target session from the given route param (same resolution as @HostOf) and
 * requires the caller to be either a player in that session (session-scoped
 * player token) or its host (Clerk games-master) — so a caller holding only a
 * session/game/team id can't enumerate its participants, teams, or scores.
 */
export const SessionMember = (from: HostResource, param = 'id') =>
  SetMetadata(SESSION_MEMBER_KEY, { from, param } satisfies HostOfMeta);
