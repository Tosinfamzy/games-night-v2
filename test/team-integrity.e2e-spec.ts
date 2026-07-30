import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { seedActiveGame, SeededActiveGame } from './utils/e2e-setup';

/**
 * Data-integrity regressions from the teams audit:
 *  - deleting a team that already has scores must succeed (score->team FK is
 *    ON DELETE CASCADE), not fail with a foreign-key violation.
 */
describe('Team data integrity (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let server: Server;
  let seed: SeededActiveGame;

  const bearer = (t: string) => `Bearer ${t}`;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;
    seed = await seedActiveGame(server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes a team that has scores without an FK violation (CASCADE)', async () => {
    const teamId = seed.teamIds[0];

    // Host scores the team.
    await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ teamId, score: 9, roundNumber: 1 })
      .expect(201);

    // Deleting the scored team used to 500 on the FK; now it cascades.
    await request(server)
      .delete(`/teams/${teamId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(200);

    // The team is gone... (read is membership-guarded — send the host token).
    await request(server)
      .get(`/teams/${teamId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(404);

    // ...and its scores went with it (leaderboard no longer references it).
    const scores = await request(server)
      .get(`/scores/games/${seed.gameId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(200);
    const body = scores.body as Array<{ teamId?: string }>;
    expect(body.every((s) => s.teamId !== teamId)).toBe(true);
  });
});
