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

  it('leaves reads and public routes open (no token needed)', async () => {
    await request(server).get(`/scores/games/${seed.gameId}`).expect(200);
    await request(server).get(`/sessions/${seed.sessionId}`).expect(200);
    await request(server).get(`/sessions/join/${seed.joinCode}`).expect(200);
  });
});
