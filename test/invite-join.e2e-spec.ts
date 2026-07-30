import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Server } from 'http';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';

interface JsonRecord {
  [k: string]: unknown;
}

/**
 * A guest can join the live session straight from their invite link — no join
 * code needed — and is checked in against their RSVP.
 */
describe('Join via invite link (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const bearer = (t: string) => `Bearer ${t}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets an invited guest join with one call and checks them in', async () => {
    // Host + a SCHEDULED session (joinable).
    const signup = await request(server)
      .post('/auth/signup')
      .send({
        email: `e2e-${randomUUID()}@example.com`,
        password: 'Password123!',
        name: 'Invite Host',
        role: 'games_master',
      })
      .expect(201);
    const gamesMasterId = (signup.body.user as JsonRecord)
      .gamesMasterId as string;

    const sessionRes = await request(server)
      .post('/sessions')
      .send({ name: 'Invite E2E', date: '2026-07-14T19:00:00Z', gamesMasterId })
      .expect(201);
    const session = sessionRes.body.session as JsonRecord;
    const sessionId = session.id as string;
    const hostToken = sessionRes.body.playerToken as string;

    // Host adds a named guest to the guest list.
    const inviteRes = await request(server)
      .post(`/sessions/${sessionId}/invites`)
      .set('Authorization', bearer(hostToken))
      .send({ name: 'Pim' })
      .expect(201);
    const inviteToken = (inviteRes.body as JsonRecord).inviteToken as string;

    // Guest joins straight from their invite link — no join code.
    const joinRes = await request(server)
      .post(`/invites/${inviteToken}/join`)
      .send({})
      .expect(201);
    const joined = joinRes.body as JsonRecord;
    const joinedSession = joined.session as JsonRecord;

    expect(joined.playerToken).toEqual(expect.any(String));
    expect(joined.playerName).toBe('Pim');
    // A joining guest is not the host — no host-only fields leak.
    expect(joinedSession.joinCode).toBeUndefined();
    expect(joinedSession.publicRsvpToken).toBeUndefined();

    // The guest is now a real player in the session...
    const players = await request(server)
      .get(`/sessions/${sessionId}/players`)
      .set('Authorization', bearer(joined.playerToken as string))
      .expect(200);
    const names = (players.body as JsonRecord[]).map((p) => p.name);
    expect(names).toContain('Pim');

    // ...and their invite has been auto-checked-in (linked + marked GOING).
    const invites = await request(server)
      .get(`/sessions/${sessionId}/invites`)
      .set('Authorization', bearer(hostToken))
      .expect(200);
    const pim = (invites.body as JsonRecord[]).find((i) => i.name === 'Pim');
    expect(pim?.rsvpStatus).toBe('GOING');
    expect(pim?.playerId).toEqual(expect.any(String));
  });

  it('rejects joining once the session is no longer accepting players', async () => {
    const signup = await request(server)
      .post('/auth/signup')
      .send({
        email: `e2e-${randomUUID()}@example.com`,
        password: 'Password123!',
        name: 'Invite Host 2',
        role: 'games_master',
      })
      .expect(201);
    const gamesMasterId = (signup.body.user as JsonRecord)
      .gamesMasterId as string;

    const sessionRes = await request(server)
      .post('/sessions')
      .send({
        name: 'Invite E2E 2',
        date: '2026-07-14T19:00:00Z',
        gamesMasterId,
      })
      .expect(201);
    const sessionId = (sessionRes.body.session as JsonRecord).id as string;
    const hostToken = sessionRes.body.playerToken as string;

    const inviteRes = await request(server)
      .post(`/sessions/${sessionId}/invites`)
      .set('Authorization', bearer(hostToken))
      .send({ name: 'Late Guest' })
      .expect(201);
    const inviteToken = (inviteRes.body as JsonRecord).inviteToken as string;

    // Cancel the session, then a join attempt is refused (not a 500).
    await request(server)
      .post(`/sessions/${sessionId}/cancel`)
      .set('Authorization', bearer(hostToken))
      .expect(200);

    await request(server)
      .post(`/invites/${inviteToken}/join`)
      .send({})
      .expect(400);
  });
});
