import * as request from 'supertest';
import { Server } from 'http';

/**
 * Result of seeding a full domain graph with a game in ROUND_IN_PROGRESS.
 * These are real, persisted entity IDs usable by score endpoints.
 */
export interface SeededActiveGame {
  gamesMasterId: string;
  sessionId: string;
  joinCode: string;
  gameLibraryId: string;
  gameId: string;
  teamIds: string[];
  playerIds: string[];
}

interface JsonRecord {
  [key: string]: unknown;
}

/**
 * POST helper that fails loudly (status + body) so a broken step in the chain
 * is obvious instead of surfacing as a confusing downstream error.
 */
async function post(
  server: Server,
  path: string,
  body: object,
  expected = 201,
): Promise<JsonRecord> {
  const res = await request(server).post(path).send(body);
  if (res.status !== expected) {
    throw new Error(
      `POST ${path} expected ${expected} but got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return res.body as JsonRecord;
}

/**
 * Drives the public API from nothing to a Game in ROUND_IN_PROGRESS so that
 * score endpoints (which require an active round) can be exercised end-to-end.
 *
 * Flow: games master -> session (GM auto-joins) -> game library entry ->
 * add game to session -> create two teams -> start game (PENDING->IN_PROGRESS)
 * -> start first round (->ROUND_IN_PROGRESS).
 */
export async function seedActiveGame(
  server: Server,
): Promise<SeededActiveGame> {
  // 1. Games master (host)
  const gm = await post(server, '/games-master', { name: 'E2E Host' });
  const gamesMasterId = gm.id as string;

  // 2. Session — the GM is auto-added as a player
  const sessionRes = await post(server, '/sessions', {
    name: 'E2E Session',
    description: 'Seeded by score e2e',
    date: '2026-07-14T19:00:00Z',
    gamesMasterId,
  });
  const session = sessionRes.session as JsonRecord;
  const sessionId = session.id as string;
  const joinCode = session.joinCode as string;
  const gmPlayer = sessionRes.gmPlayer as JsonRecord;
  const playerIds: string[] = [gmPlayer.id as string];

  // 3. Game library entry (low player bounds to avoid count constraints)
  const lib = await post(server, '/game-library', {
    name: `E2E Game ${joinCode}`,
    description: 'A seeded game-library entry for e2e tests.',
    minPlayers: 1,
    maxPlayers: 20,
    estimatedDuration: 30,
    difficulty: 'Easy',
    categories: ['Test'],
  });
  const gameLibraryId = lib.id as string;

  // 5. Add the game to the session (response exposes gameIds)
  const sessionWithGame = await post(server, `/sessions/${sessionId}/games`, {
    gameLibraryIds: [gameLibraryId],
  });
  const gameIds = sessionWithGame.gameIds as string[];
  const gameId = gameIds[0];

  // 6. Create two teams directly for the game. startGame only requires that two
  //    teams exist (it does not require players assigned), and automatic team
  //    formation needs players in PLAYING status, which no endpoint sets.
  const teamIds: string[] = [];
  for (const name of ['E2E Red', 'E2E Blue']) {
    const team = await post(server, '/teams', { name, gameId });
    teamIds.push(team.id as string);
  }

  // 7. Start the game: PENDING -> IN_PROGRESS
  await post(server, `/games/${gameId}/start`, { teamIds }, 201);

  // 8. Start the first round: IN_PROGRESS -> ROUND_IN_PROGRESS
  await post(server, `/games/${gameId}/start-first-round`, {}, 201);

  return {
    gamesMasterId,
    sessionId,
    joinCode,
    gameLibraryId,
    gameId,
    teamIds,
    playerIds,
  };
}
