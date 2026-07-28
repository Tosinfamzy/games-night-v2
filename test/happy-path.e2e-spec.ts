import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../src/app.module';

/**
 * Full "games night" happy-path e2e.
 *
 * Walks the real end-to-end flow a host and players go through on the night,
 * against a live Postgres + Redis (the CI e2e harness):
 *
 *   signup/login (games master) -> create session -> attach a game from the
 *   library -> two players join by code -> form + populate teams -> start the
 *   game -> score each team -> read the leaderboard -> complete -> read history
 *   and chat history.
 *
 * Notes that match the app's actual wiring:
 *  - The e2e app is built straight from AppModule, so there is NO `/v1` URI
 *    prefix here (that is applied in main.ts only). Routes are at the root.
 *  - Most REST routes are not JWT-guarded at runtime; we still send the GM's
 *    Bearer token to mirror real usage.
 *  - Unique emails/player names per run keep the suite idempotent against a
 *    persistent local DB (CI gets a fresh DB each run).
 */

interface JsonRecord {
  [key: string]: unknown;
}

describe('Games Night happy path (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let server: Server;

  // Shared state threaded through the ordered steps below.
  let accessToken: string;
  let gamesMasterId: string;
  let sessionId: string;
  let joinCode: string;
  let gmPlayerId: string;
  let gameLibraryId: string;
  let gameId: string;
  let redTeamId: string;
  let blueTeamId: string;
  let playerAId: string;
  let playerBId: string;

  const unique = uuidv4().slice(0, 8);
  const gmEmail = `gm-${unique}@example.com`;
  const gmPassword = 'Password123!';

  /** POST that fails loudly (status + body) so a broken step is obvious. */
  async function post(
    path: string,
    body: object,
    accepted: number[] = [200, 201],
  ): Promise<JsonRecord> {
    const res = await request(server)
      .post(path)
      .set('Authorization', `Bearer ${accessToken ?? ''}`)
      .send(body);
    if (!accepted.includes(res.status)) {
      throw new Error(
        `POST ${path} expected ${accepted.join('/')} but got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    return res.body as JsonRecord;
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror the existing e2e suite: plain ValidationPipe, no global prefix.
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. signs up a games master and returns an access token', async () => {
    const body = await post('/auth/signup', {
      email: gmEmail,
      password: gmPassword,
      name: 'E2E Host',
      role: 'games_master',
    });

    accessToken = body.accessToken as string;
    const user = body.user as JsonRecord;
    gamesMasterId = user.gamesMasterId as string;

    expect(accessToken).toEqual(expect.any(String));
    expect(gamesMasterId).toEqual(expect.any(String));
  });

  it('2. logs in with the same credentials', async () => {
    const body = await post('/auth/login', {
      email: gmEmail,
      password: gmPassword,
    });

    // Refresh the token from the login response (also proves login works).
    accessToken = body.accessToken as string;
    expect(accessToken).toEqual(expect.any(String));
  });

  it('3. creates a session (GM auto-joins as a player)', async () => {
    const body = await post('/sessions', {
      name: 'E2E Games Night',
      description: 'Full happy-path e2e',
      date: '2026-07-14T19:00:00Z',
      gamesMasterId,
    });

    const session = body.session as JsonRecord;
    const gmPlayer = body.gmPlayer as JsonRecord;
    sessionId = session.id as string;
    joinCode = session.joinCode as string;
    gmPlayerId = gmPlayer.id as string;

    expect(sessionId).toEqual(expect.any(String));
    expect(joinCode).toMatch(/^\d{6}$/);
    expect(gmPlayerId).toEqual(expect.any(String));

    // Host-only control endpoints are authorized by the HostGuard via the
    // session-scoped player token (there is no games-master login). Switch the
    // helper's bearer to the host's player token for the rest of the flow.
    expect(body.playerToken).toEqual(expect.any(String));
    accessToken = body.playerToken as string;
  });

  it('4. adds a game from the library to the session', async () => {
    const lib = await post('/game-library', {
      name: `E2E Game ${unique}`,
      description: 'A seeded game-library entry for the happy-path e2e.',
      minPlayers: 1,
      maxPlayers: 20,
      estimatedDuration: 30,
      difficulty: 'Easy',
      categories: ['Test'],
    });
    gameLibraryId = lib.id as string;

    const sessionWithGame = await post(`/sessions/${sessionId}/games`, {
      gameLibraryIds: [gameLibraryId],
    });
    const gameIds = sessionWithGame.gameIds as string[];
    gameId = gameIds[0];

    expect(gameLibraryId).toEqual(expect.any(String));
    expect(gameId).toEqual(expect.any(String));
  });

  it('5. lets two players join by code (returns player tokens)', async () => {
    const a = await post('/sessions/join', {
      joinCode,
      playerName: `Alice-${unique}`,
    });
    const b = await post('/sessions/join', {
      joinCode,
      playerName: `Bob-${unique}`,
    });

    playerAId = a.playerId as string;
    playerBId = b.playerId as string;

    expect(playerAId).toEqual(expect.any(String));
    expect(playerBId).toEqual(expect.any(String));
    expect(a.playerToken).toEqual(expect.any(String));
    expect(b.playerToken).toEqual(expect.any(String));
  });

  it('6. creates two session teams linked to the game', async () => {
    // Session-scoped teams (not POST /teams) so they are linked to the session
    // and can be found by the session-scoped assignment route below.
    const red = await post(`/sessions/${sessionId}/teams`, {
      name: 'E2E Red',
      gameId,
    });
    const blue = await post(`/sessions/${sessionId}/teams`, {
      name: 'E2E Blue',
      gameId,
    });
    redTeamId = red.id as string;
    blueTeamId = blue.id as string;

    expect(redTeamId).toEqual(expect.any(String));
    expect(blueTeamId).toEqual(expect.any(String));
  });

  /** PUT that fails loudly, used for the session-scoped team assignment. */
  async function put(path: string, body: object): Promise<JsonRecord> {
    const res = await request(server)
      .put(path)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
    if (res.status !== 200) {
      throw new Error(
        `PUT ${path} expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    return res.body as JsonRecord;
  }

  it('7. assigns players to teams', async () => {
    await put(`/sessions/${sessionId}/teams/${redTeamId}/players`, {
      playerIds: [gmPlayerId, playerAId],
    });
    const blueTeam = await put(
      `/sessions/${sessionId}/teams/${blueTeamId}/players`,
      { playerIds: [playerBId] },
    );

    expect((blueTeam.playerIds as string[]) ?? []).toContain(playerBId);
  });

  it('8. marks every player ready', async () => {
    for (const playerId of [gmPlayerId, playerAId, playerBId]) {
      await post(`/sessions/${sessionId}/players/${playerId}/ready`, {
        ready: true,
      });
    }
  });

  it('9. starts the session, game, and first round', async () => {
    await post(`/sessions/${sessionId}/start`, {});
    await post(`/games/${gameId}/start`, { teamIds: [redTeamId, blueTeamId] });
    await post(`/games/${gameId}/start-first-round`, {});
  });

  it('10. scores each team and awards a bonus', async () => {
    await post(`/scores/games/${gameId}/submit`, {
      teamId: redTeamId,
      score: 25,
      roundNumber: 1,
    });
    await post(`/scores/games/${gameId}/submit`, {
      teamId: blueTeamId,
      score: 15,
      roundNumber: 1,
    });
    await post('/scores', {
      gameId,
      teamId: redTeamId,
      points: 10,
      isBonus: true,
    });
  });

  it('11. reads the aggregated team leaderboard for the game', async () => {
    const res = await request(server)
      .get(`/scores/games/${gameId}`)
      .expect(200);
    const scores = res.body as Array<{
      teamId: string;
      teamName: string;
      totalPoints: number;
      bonusPointsCount: number;
    }>;

    expect(Array.isArray(scores)).toBe(true);
    expect(scores.length).toBeGreaterThanOrEqual(2);
    for (const s of scores) {
      expect(s).toHaveProperty('teamId');
      expect(s).toHaveProperty('teamName');
      expect(s).toHaveProperty('totalPoints');
    }
    const total = scores.reduce((sum, s) => sum + (s.totalPoints ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(25);
  });

  it('12. reads the session leaderboard', async () => {
    await request(server).get(`/sessions/${sessionId}/leaderboard`).expect(200);
  });

  it('13. completes the game and the session', async () => {
    await post(`/games/${gameId}/complete`, {});
    await post(`/sessions/${sessionId}/complete`, {});
  });

  it('14. reads game results and session history', async () => {
    await request(server).get(`/games/${gameId}/results`).expect(200);

    const res = await request(server)
      .get(`/history/games`)
      .query({ sessionId })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('15. reads chat history for the session (HTTP surface)', async () => {
    // The controller merges the path :sessionId into the query DTO only after
    // validation runs, and MessageHistoryQueryDto.sessionId is required — so the
    // sessionId must also be passed as a query param or the endpoint 400s.
    const res = await request(server)
      .get(`/chat/sessions/${sessionId}/messages`)
      .query({ sessionId })
      .expect(200);
    const body = res.body as { messages: unknown[]; hasMore: boolean };
    expect(Array.isArray(body.messages)).toBe(true);
    expect(typeof body.hasMore).toBe('boolean');
  });
});
