import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InviteService } from './invite.service';
import { Invite } from './invite.entity';
import { Session } from '../session/session.entity';
import { SessionPlayerService } from '../session/services/session-player.service';
import { RsvpStatus } from './enums/rsvp-status.enum';
import { SessionStatus } from '../session/enums/session-status.enum';

type MockRepo = {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  remove: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const mockRepo = (): MockRepo => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

/** A chainable query-builder mock whose getOne() resolves to `result`. */
function mockQb(result: unknown) {
  const qb = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    getOne: jest.fn(() => Promise.resolve(result)),
  };
  return qb;
}

function invite(status: RsvpStatus, plusOnes = 0): Invite {
  return { rsvpStatus: status, plusOnes } as Invite;
}

describe('InviteService', () => {
  let service: InviteService;
  let inviteRepo: MockRepo;
  let sessionRepo: MockRepo;
  let events: { emit: jest.Mock };
  let sessionPlayerService: { joinSession: jest.Mock };

  beforeEach(async () => {
    inviteRepo = mockRepo();
    sessionRepo = mockRepo();
    events = { emit: jest.fn() };
    sessionPlayerService = { joinSession: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        { provide: getRepositoryToken(Invite), useValue: inviteRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: EventEmitter2, useValue: events },
        { provide: SessionPlayerService, useValue: sessionPlayerService },
      ],
    }).compile();

    service = moduleRef.get(InviteService);
  });

  describe('summary', () => {
    it('tallies statuses and counts headcount from GOING + plus-ones', async () => {
      inviteRepo.find.mockResolvedValue([
        invite(RsvpStatus.GOING, 2),
        invite(RsvpStatus.GOING, 0),
        invite(RsvpStatus.MAYBE),
        invite(RsvpStatus.NOT_GOING),
        invite(RsvpStatus.PENDING),
      ]);

      const summary = await service.summary('session-1');

      expect(summary).toEqual({
        total: 5,
        going: 2,
        maybe: 1,
        notGoing: 1,
        pending: 1,
        headcount: 4, // (1+2) + (1+0)
      });
    });
  });

  describe('createForSession', () => {
    it('creates a PENDING invite with a token and emits an update', async () => {
      sessionRepo.findOne.mockResolvedValue({ id: 'session-1' });
      inviteRepo.create.mockImplementation((data: Partial<Invite>) => data);
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve({ ...data, id: 'invite-1' }),
      );

      const result = await service.createForSession('session-1', {
        name: 'Ada',
      });

      expect(result.rsvpStatus).toBe(RsvpStatus.PENDING);
      expect(result.inviteToken).toEqual(expect.any(String));
      expect(events.emit).toHaveBeenCalledWith(
        'invite.updated',
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });
  });

  describe('rsvp', () => {
    it('applies the response, stamps respondedAt, and emits', async () => {
      const existing = {
        id: 'invite-1',
        sessionId: 'session-1',
        rsvpStatus: RsvpStatus.PENDING,
        plusOnes: 0,
      } as Invite;
      inviteRepo.findOne.mockResolvedValue(existing);
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve(data),
      );

      const result = await service.rsvp('token-abc', {
        status: RsvpStatus.GOING,
        plusOnes: 2,
      });

      expect(result.rsvpStatus).toBe(RsvpStatus.GOING);
      expect(result.plusOnes).toBe(2);
      expect(result.respondedAt).toBeInstanceOf(Date);
      expect(events.emit).toHaveBeenCalledWith(
        'invite.updated',
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });
  });

  describe('getPublicRsvpView', () => {
    it('returns a public projection with going headcount and no host email', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        name: 'Games Night',
        status: SessionStatus.SCHEDULED,
        date: new Date('2026-09-01T19:00:00Z'),
        location: 'HQ',
        description: null,
        inviteMessage: "You're invited! 🎲",
        host: { name: 'Ada', email: 'secret@host.com' },
      });
      inviteRepo.find.mockResolvedValue([invite(RsvpStatus.GOING, 2)]);

      const view = await service.getPublicRsvpView('rsvp-token');

      expect(view).toEqual({
        sessionId: 'session-1',
        sessionName: 'Games Night',
        status: SessionStatus.SCHEDULED,
        date: new Date('2026-09-01T19:00:00Z'),
        location: 'HQ',
        description: null,
        inviteMessage: "You're invited! 🎲",
        hostName: 'Ada',
        goingHeadcount: 3, // 1 + 2 plus-ones
      });
      expect(JSON.stringify(view)).not.toContain('secret@host.com');
    });
  });

  describe('joinViaInvite', () => {
    it("joins the invite's session under the RSVP name via the normal flow", async () => {
      inviteRepo.findOne.mockResolvedValue({
        id: 'invite-1',
        name: 'Alice',
        session: { id: 'session-1', joinCode: '123456' },
      });
      const joinResult = {
        session: {},
        player: { id: 'p1', name: 'Alice' },
        message: 'ok',
        playerToken: 'tok',
      };
      sessionPlayerService.joinSession.mockResolvedValue(joinResult);

      const result = await service.joinViaInvite('invite-token');

      // Uses the invite's session join code + the RSVP name, so the join-flow's
      // name->invite bridge checks this very guest in.
      expect(sessionPlayerService.joinSession).toHaveBeenCalledWith({
        joinCode: '123456',
        playerName: 'Alice',
      });
      expect(result).toBe(joinResult);
    });

    it('falls back to a provided name when the invite has none', async () => {
      inviteRepo.findOne.mockResolvedValue({
        id: 'invite-2',
        name: null,
        session: { id: 'session-1', joinCode: '654321' },
      });
      sessionPlayerService.joinSession.mockResolvedValue({});

      await service.joinViaInvite('invite-token', 'Bob');

      expect(sessionPlayerService.joinSession).toHaveBeenCalledWith({
        joinCode: '654321',
        playerName: 'Bob',
      });
    });
  });

  describe('selfRsvp', () => {
    it('creates a new invite when none matches, and emits', async () => {
      sessionRepo.findOne.mockResolvedValue({ id: 'session-1' });
      inviteRepo.createQueryBuilder.mockReturnValue(mockQb(null));
      inviteRepo.create.mockImplementation((data: Partial<Invite>) => data);
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve({ ...data, id: 'invite-9' }),
      );

      const result = await service.selfRsvp('rsvp-token', {
        name: 'Grace',
        email: 'grace@example.com',
        status: RsvpStatus.GOING,
        plusOnes: 1,
      });

      expect(result.name).toBe('Grace');
      expect(result.rsvpStatus).toBe(RsvpStatus.GOING);
      expect(result.plusOnes).toBe(1);
      expect(result.inviteToken).toEqual(expect.any(String));
      expect(events.emit).toHaveBeenCalledWith(
        'invite.updated',
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('updates the existing invite instead of duplicating (dedupe)', async () => {
      const existing = {
        id: 'invite-1',
        inviteToken: 'existing-token',
        name: 'Grace',
        rsvpStatus: RsvpStatus.PENDING,
        plusOnes: 0,
      } as Invite;
      sessionRepo.findOne.mockResolvedValue({ id: 'session-1' });
      inviteRepo.createQueryBuilder.mockReturnValue(mockQb(existing));
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve(data),
      );

      const result = await service.selfRsvp('rsvp-token', {
        name: 'Grace',
        email: 'grace@example.com',
        status: RsvpStatus.MAYBE,
      });

      expect(inviteRepo.create).not.toHaveBeenCalled();
      expect(result.id).toBe('invite-1');
      expect(result.inviteToken).toBe('existing-token');
      expect(result.rsvpStatus).toBe(RsvpStatus.MAYBE);
    });

    it('zeroes plus-ones when status is not GOING', async () => {
      sessionRepo.findOne.mockResolvedValue({ id: 'session-1' });
      inviteRepo.createQueryBuilder.mockReturnValue(mockQb(null));
      inviteRepo.create.mockImplementation((data: Partial<Invite>) => data);
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve(data),
      );

      const result = await service.selfRsvp('rsvp-token', {
        name: 'Grace',
        email: 'grace@example.com',
        status: RsvpStatus.MAYBE,
        plusOnes: 5,
      });

      expect(result.plusOnes).toBe(0);
    });
  });

  describe('linkPlayerToInvite', () => {
    it('links a matching invite and upgrades PENDING to GOING', async () => {
      const match = {
        id: 'invite-1',
        rsvpStatus: RsvpStatus.PENDING,
        plusOnes: 0,
      } as Invite;
      inviteRepo.createQueryBuilder.mockReturnValue(mockQb(match));
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve(data),
      );

      await service.linkPlayerToInvite({
        sessionId: 'session-1',
        playerId: 'player-1',
        playerName: 'Grace',
      });

      expect(match.playerId).toBe('player-1');
      expect(match.rsvpStatus).toBe(RsvpStatus.GOING);
      expect(events.emit).toHaveBeenCalledWith(
        'invite.updated',
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('does nothing when no invite matches (walk-in)', async () => {
      inviteRepo.createQueryBuilder.mockReturnValue(mockQb(null));

      await service.linkPlayerToInvite({
        sessionId: 'session-1',
        playerId: 'player-1',
        playerName: 'Nobody',
      });

      expect(inviteRepo.save).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('preserves an existing NOT_GOING/GOING status when linking', async () => {
      const match = {
        id: 'invite-1',
        rsvpStatus: RsvpStatus.NOT_GOING,
        plusOnes: 0,
      } as Invite;
      inviteRepo.createQueryBuilder.mockReturnValue(mockQb(match));
      inviteRepo.save.mockImplementation((data: Invite) =>
        Promise.resolve(data),
      );

      await service.linkPlayerToInvite({
        sessionId: 'session-1',
        playerId: 'player-1',
        playerName: 'Grace',
      });

      // They said no but showed up: link them, but don't rewrite their answer.
      expect(match.playerId).toBe('player-1');
      expect(match.rsvpStatus).toBe(RsvpStatus.NOT_GOING);
    });
  });
});
