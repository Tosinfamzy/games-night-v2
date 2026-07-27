import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InviteService } from './invite.service';
import { Invite } from './invite.entity';
import { Session } from '../session/session.entity';
import { RsvpStatus } from './enums/rsvp-status.enum';

type MockRepo = {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  remove: jest.Mock;
};

const mockRepo = (): MockRepo => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

function invite(status: RsvpStatus, plusOnes = 0): Invite {
  return { rsvpStatus: status, plusOnes } as Invite;
}

describe('InviteService', () => {
  let service: InviteService;
  let inviteRepo: MockRepo;
  let sessionRepo: MockRepo;
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    inviteRepo = mockRepo();
    sessionRepo = mockRepo();
    events = { emit: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        { provide: getRepositoryToken(Invite), useValue: inviteRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: EventEmitter2, useValue: events },
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
});
