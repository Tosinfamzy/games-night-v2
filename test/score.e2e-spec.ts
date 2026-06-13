import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../src/app.module';
import { CreateScoreDto } from '../src/score/dto/create-score.dto';
import { SubmitGameScoreDto } from '../src/score/dto/submit-game-score.dto';
import { seedActiveGame, SeededActiveGame } from './utils/e2e-setup';

interface TeamScoreResponse {
  teamId: string;
  teamName: string;
  totalPoints: number;
  bonusPointsCount: number;
}

interface ScoreResponse {
  id: string;
  points: number;
  gameId: string;
  teamId: string | null;
}

describe('ScoreController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let httpServer: Server;
  let seed: SeededActiveGame;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    httpServer = app.getHttpServer() as Server;

    // Seed a full domain graph with a game in ROUND_IN_PROGRESS so the score
    // endpoints (which require an active round) can be exercised for real.
    seed = await seedActiveGame(httpServer);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /scores', () => {
    it('should create a score for an active game and team', async () => {
      const dto: CreateScoreDto = {
        points: 10,
        gameId: seed.gameId,
        teamId: seed.teamIds[0],
      };

      const response = await request(httpServer)
        .post('/scores')
        .send(dto)
        .expect(201);

      expect(response.body as ScoreResponse).toMatchObject({
        points: 10,
        gameId: seed.gameId,
        teamId: seed.teamIds[0],
      });
    });

    it('should fail with invalid input', async () => {
      await request(httpServer)
        .post('/scores')
        .send({ points: -1, gameId: 'not-a-uuid', teamId: 'not-a-uuid' })
        .expect(400);
    });

    it('should return 404 when the game does not exist', async () => {
      await request(httpServer)
        .post('/scores')
        .send({ points: 10, gameId: uuidv4(), teamId: seed.teamIds[0] })
        .expect(404);
    });
  });

  describe('POST /scores/games/:gameId/submit', () => {
    it('should submit a game score for an active game', async () => {
      const dto: SubmitGameScoreDto = { teamId: seed.teamIds[1], score: 25 };

      await request(httpServer)
        .post(`/scores/games/${seed.gameId}/submit`)
        .send(dto)
        .expect(201);
    });

    it('should return 404 when the game does not exist', async () => {
      const dto: SubmitGameScoreDto = { teamId: seed.teamIds[0], score: 5 };

      await request(httpServer)
        .post(`/scores/games/${uuidv4()}/submit`)
        .send(dto)
        .expect(404);
    });

    it('should return 400 for a malformed game ID', async () => {
      await request(httpServer)
        .post('/scores/games/not-a-uuid/submit')
        .send({ teamId: seed.teamIds[0], score: 5 })
        .expect(400);
    });
  });

  describe('GET /scores/games/:gameId', () => {
    it('should return aggregated team scores for a game with scores', async () => {
      const response = await request(httpServer)
        .get(`/scores/games/${seed.gameId}`)
        .expect(200);

      const scores = response.body as TeamScoreResponse[];
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBeGreaterThan(0);

      for (const teamScore of scores) {
        expect(teamScore).toHaveProperty('teamId');
        expect(teamScore).toHaveProperty('teamName');
        expect(teamScore).toHaveProperty('totalPoints');
        expect(teamScore).toHaveProperty('bonusPointsCount');
      }
    });

    it('should return an empty array for a game with no scores', async () => {
      // getGameScores does not assert game existence; an unknown game simply
      // has no scores, so the endpoint returns 200 with an empty array.
      const response = await request(httpServer)
        .get(`/scores/games/${uuidv4()}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
