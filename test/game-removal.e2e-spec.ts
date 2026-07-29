import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { seedActiveGame, SeededActiveGame } from './utils/e2e-setup';

/**
 * Removing a game used to 500 whenever it had play data: score/team/game_result
 * FKs were NO ACTION, so Postgres refused the delete. They're now ON DELETE
 * CASCADE — this verifies a game with teams and scores deletes cleanly.
 */
describe('Game removal cascade (e2e)', () => {
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

  it('cascade-deletes a game that has teams and scores (no FK 500)', async () => {
    // Give the game a score so the score→game FK is actually exercised.
    await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ teamId: seed.teamIds[0], score: 5 })
      .expect(201);

    // Previously an FK violation → 500; now cascades scores + teams.
    await request(server)
      .delete(`/games/${seed.gameId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(204);

    // The game (and, by cascade, its scores/teams) is gone.
    await request(server).get(`/games/${seed.gameId}`).expect(404);
  });
});
