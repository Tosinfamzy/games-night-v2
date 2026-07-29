import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { seedActiveGame, SeededActiveGame } from './utils/e2e-setup';

/**
 * Verifies the HostGuard actually protects host-only control endpoints: only the
 * session host (with their session-scoped player token) may act; anonymous and
 * non-host callers are rejected; public/read routes stay open.
 */
describe('Host authorization (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let server: Server;
  let seed: SeededActiveGame;
  let nonHostToken: string;
  let nonHostPlayerId: string;

  const bearer = (t?: string) => (t ? `Bearer ${t}` : '');

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;

    seed = await seedActiveGame(server);

    // A regular (non-host) player in the same session.
    const joinRes = await request(server)
      .post('/sessions/join')
      .send({ joinCode: seed.joinCode, playerName: 'Not The Host' })
      .expect(201);
    nonHostToken = (joinRes.body as { playerToken: string }).playerToken;
    nonHostPlayerId = (joinRes.body as { playerId: string }).playerId;
  });

  afterAll(async () => {
    await app.close();
  });

  const submit = () => ({ teamId: seed.teamIds[0], score: 7, roundNumber: 1 });

  it('rejects an anonymous score submit (no token)', async () => {
    const res = await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .send(submit());
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('rejects a non-host player submitting a score (403)', async () => {
    await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .set('Authorization', bearer(nonHostToken))
      .send(submit())
      .expect(403);
  });

  it('rejects a non-host player controlling the game (403)', async () => {
    await request(server)
      .post(`/games/${seed.gameId}/pause`)
      .set('Authorization', bearer(nonHostToken))
      .send({})
      .expect(403);
  });

  it('rejects an anonymous session-lifecycle action', async () => {
    const res = await request(server)
      .post(`/sessions/${seed.sessionId}/complete`)
      .send({});
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('allows the host to submit a score with their token (201)', async () => {
    await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .set('Authorization', bearer(seed.hostToken))
      .send(submit())
      .expect(201);
  });

  it('accepts a negative score (penalty rounds)', async () => {
    await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ teamId: seed.teamIds[0], score: -5, roundNumber: 1 })
      .expect(201);
  });

  it('leaves reads and public routes open (no token needed)', async () => {
    await request(server).get(`/scores/games/${seed.gameId}`).expect(200);
    await request(server).get(`/sessions/${seed.sessionId}`).expect(200);
    await request(server).get(`/sessions/join/${seed.joinCode}`).expect(200);
  });

  it('does not leak the host RSVP token to anonymous session reads', async () => {
    const byId = await request(server)
      .get(`/sessions/${seed.sessionId}`)
      .expect(200);
    expect(
      (byId.body as { publicRsvpToken?: string }).publicRsvpToken,
    ).toBeUndefined();

    const byCode = await request(server)
      .get(`/sessions/join/${seed.joinCode}`)
      .expect(200);
    expect(
      (byCode.body as { publicRsvpToken?: string }).publicRsvpToken,
    ).toBeUndefined();
  });

  // The /teams/* controller is a parallel mutation surface — it must be
  // host-gated too, or the session/game guards are trivially bypassed.
  it('rejects an anonymous team mutation (no token)', async () => {
    const res = await request(server)
      .put(`/teams/${seed.teamIds[0]}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('rejects a non-host player mutating a team (403)', async () => {
    await request(server)
      .put(`/teams/${seed.teamIds[0]}`)
      .set('Authorization', bearer(nonHostToken))
      .send({ name: 'Hacked' })
      .expect(403);
  });

  it('allows the host to mutate a team with their token (200)', async () => {
    await request(server)
      .put(`/teams/${seed.teamIds[0]}`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ name: 'Renamed By Host' })
      .expect(200);
  });

  // Previously-open controllers that the audit flagged (§1).
  it('rejects anonymous access to a session guest list (PII)', async () => {
    const res = await request(server).get(
      `/sessions/${seed.sessionId}/invites`,
    );
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('rejects a non-host reading the guest list (403)', async () => {
    await request(server)
      .get(`/sessions/${seed.sessionId}/invites`)
      .set('Authorization', bearer(nonHostToken))
      .expect(403);
  });

  it('rejects anonymous chat-history reads', async () => {
    const res = await request(server)
      .get(`/chat/sessions/${seed.sessionId}/messages`)
      .query({ sessionId: seed.sessionId });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('rejects anonymous player mutation (IDOR)', async () => {
    const res = await request(server)
      .put(`/players/${seed.playerIds[0]}`)
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('rejects a non-host mutating another player (403)', async () => {
    await request(server)
      .delete(`/players/${seed.playerIds[0]}`)
      .set('Authorization', bearer(nonHostToken))
      .expect(403);
  });

  // Session player-status routes are host-or-self, not open (SessionActorGuard).
  it('rejects an anonymous player-ready change', async () => {
    const res = await request(server)
      .post(`/sessions/${seed.sessionId}/players/${seed.playerIds[0]}/ready`)
      .send({ ready: true });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });

  it('rejects a non-host changing another player’s ready (403)', async () => {
    await request(server)
      .post(`/sessions/${seed.sessionId}/players/${seed.playerIds[0]}/ready`)
      .set('Authorization', bearer(nonHostToken))
      .send({ ready: true })
      .expect(403);
  });

  it('allows a player to change their own ready (self-service)', async () => {
    await request(server)
      .post(`/sessions/${seed.sessionId}/players/${nonHostPlayerId}/ready`)
      .set('Authorization', bearer(nonHostToken))
      .send({ ready: true })
      .expect(201);
  });

  it('allows the host to change any player’s ready', async () => {
    await request(server)
      .post(`/sessions/${seed.sessionId}/players/${nonHostPlayerId}/ready`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ ready: false })
      .expect(201);
  });

  // Admin cross-tenant list endpoints must not be an anonymous data dump.
  it.each(['/games', '/teams', '/scores', '/history/games'])(
    'rejects anonymous access to admin list %s',
    async (path) => {
      const res = await request(server).get(path);
      expect(res.status).toBe(400);
      expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
    },
  );

  it('rejects anonymous game-library mutation', async () => {
    const res = await request(server)
      .post('/game-library')
      .send({
        name: 'Anon Game',
        description: 'x',
        minPlayers: 2,
        maxPlayers: 4,
        estimatedDuration: 10,
        difficulty: 'Easy',
        categories: ['x'],
      });
    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe('TOKEN_INVALID');
  });
});
