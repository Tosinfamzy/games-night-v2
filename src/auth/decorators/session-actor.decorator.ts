import { SetMetadata } from '@nestjs/common';

/**
 * Which route params identify the session and the target player for a
 * player-status action guarded by SessionActorGuard.
 */
export interface SessionActorMeta {
  session: string;
  player: string;
}

export const SESSION_ACTOR_KEY = 'sessionActor';

/**
 * Marks a route as a session player-status action: the caller must belong to
 * the session and be either the target player themselves (self-service) or the
 * session host. Resolves the session and target player from the given params.
 */
export const SessionActor = (session: string, player: string) =>
  SetMetadata(SESSION_ACTOR_KEY, {
    session,
    player,
  } satisfies SessionActorMeta);
