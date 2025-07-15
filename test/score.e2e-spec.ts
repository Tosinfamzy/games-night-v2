import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { CreateScoreDto } from '../src/score/dto/create-score.dto';
import { SubmitGameScoreDto } from '../src/score/dto/submit-game-score.dto';
import { v4 as uuidv4 } from 'uuid';

interface GameScoreResponse {
  teamId: string;
  teamName: string;
  totalPoints: number;
  bonusPointsCount: number;
}

interface ScoreResponse {
  id: string;
  points: number;
  game: { id: string };
  team: { id: string };
}

// Helper function to type-safely create a supertest request
const supertestRequest = (server: Server | string) => request(server);

describe('ScoreController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let httpServer: Server;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /scores', () => {
    it('should create a score', async () => {
      const dto: CreateScoreDto = {
        points: 10,
        gameId: uuidv4(),
        teamId: uuidv4(),
      };

      const response = await supertestRequest(httpServer)
        .post('/scores')
        .send(dto)
        .expect(201);

      expect(response.body as ScoreResponse).toMatchObject({
        points: dto.points,
        game: { id: dto.gameId },
        team: { id: dto.teamId },
      });
    });

    it('should fail with invalid input', async () => {
      const invalidDto = {
        points: -1,
        gameId: 'not-a-uuid',
        teamId: 'not-a-uuid',
      };

      await supertestRequest(httpServer)
        .post('/scores')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /scores/games/:gameId/submit', () => {
    it('should submit game scores', async () => {
      const gameId = uuidv4();
      const scores: SubmitGameScoreDto[] = [
        { teamId: uuidv4(), score: 10 },
        { teamId: uuidv4(), score: 5 },
      ];

      await supertestRequest(httpServer)
        .post(`/scores/games/${gameId}/submit`)
        .send(scores)
        .expect(201);
    });

    it('should fail with invalid game ID', async () => {
      const scores: SubmitGameScoreDto[] = [{ teamId: uuidv4(), score: 10 }];

      await supertestRequest(httpServer)
        .post('/scores/games/invalid-uuid/submit')
        .send(scores)
        .expect(400);
    });
  });

  describe('GET /scores/games/:gameId', () => {
    it('should get game scores', async () => {
      const gameId = uuidv4();

      const response = await supertestRequest(httpServer)
        .get(`/scores/games/${gameId}`)
        .expect(200);

      const scores = response.body as GameScoreResponse[];
      expect(Array.isArray(scores)).toBe(true);

      if (scores.length > 0) {
        const firstScore = scores[0];
        expect(firstScore).toHaveProperty('teamId');
        expect(firstScore).toHaveProperty('teamName');
        expect(firstScore).toHaveProperty('totalPoints');
        expect(firstScore).toHaveProperty('bonusPointsCount');
      }
    });

    it('should return 404 for non-existent game', async () => {
      const nonExistentGameId = uuidv4();

      await supertestRequest(httpServer)
        .get(`/scores/games/${nonExistentGameId}`)
        .expect(404);
    });
  });
});
