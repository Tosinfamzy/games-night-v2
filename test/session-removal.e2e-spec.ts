import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { seedActiveGame, SeededActiveGame } from './utils/e2e-setup';

/**
 * The session subtree (game/team/player/game_result/messages) used to be
 * NO ACTION, so deleting a non-empty session — or a player who was on a team —
 * 500'd on a foreign-key violation. These verify the cascades/detach work.
 */
describe('Session & player removal cascade (e2e)', () => {
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

  it('deletes a player who is on a team without an FK 500', async () => {
    // Join a fresh (non-host) player and put them on a team, then delete them —
    // this exercises the team_players_player join FK that used to 500.
    const join = await request(server)
      .post('/sessions/join')
      .send({ joinCode: seed.joinCode, playerName: 'Cascade Tester' })
      .expect(201);
    const playerId = (join.body as { playerId: string }).playerId;

    await request(server)
      .put(`/sessions/${seed.sessionId}/teams/${seed.teamIds[0]}/players`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ playerIds: [playerId] })
      .expect(200);

    await request(server)
      .delete(`/players/${playerId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(204);
  });

  it('deletes a non-empty session whose players are on teams', async () => {
    // The session has games, teams, players and a submitted score by now.
    await request(server)
      .post(`/scores/games/${seed.gameId}/submit`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ teamId: seed.teamIds[0], score: 3 })
      .expect(201);

    // Put a player on a team so team_players_player has rows — deleting the
    // session must clean those first, or the session→player DB cascade 500s on
    // that NO-ACTION junction FK (the exact prod bug this guards against).
    const join = await request(server)
      .post('/sessions/join')
      .send({ joinCode: seed.joinCode, playerName: 'On A Team' })
      .expect(201);
    await request(server)
      .put(`/sessions/${seed.sessionId}/teams/${seed.teamIds[0]}/players`)
      .set('Authorization', bearer(seed.hostToken))
      .send({ playerIds: [(join.body as { playerId: string }).playerId] })
      .expect(200);

    await request(server)
      .delete(`/sessions/${seed.sessionId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(200);

    // Session (and by cascade its games) is gone. The game read is
    // membership-guarded, so send the host token to reach the 404.
    await request(server).get(`/sessions/${seed.sessionId}`).expect(404);
    await request(server)
      .get(`/games/${seed.gameId}`)
      .set('Authorization', bearer(seed.hostToken))
      .expect(404);
  });
});
