import { ReminderService } from './reminder.service';
import { Invite } from './invite.entity';
import { RsvpStatus } from './enums/rsvp-status.enum';

type Qb = {
  leftJoinAndSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock;
};

function qbReturning(invites: Invite[]): Qb {
  const qb: Partial<Qb> = {};
  qb.leftJoinAndSelect = jest.fn(() => qb as Qb);
  qb.where = jest.fn(() => qb as Qb);
  qb.andWhere = jest.fn(() => qb as Qb);
  qb.getMany = jest.fn(() => Promise.resolve(invites));
  return qb as Qb;
}

function eligibleInvite(over: Partial<Invite> = {}): Invite {
  return {
    id: 'inv-1',
    name: 'Pim',
    email: 'pim@example.com',
    inviteToken: 'tok-1',
    rsvpStatus: RsvpStatus.GOING,
    reminderSentAt: undefined,
    session: {
      id: 'sess-1',
      name: 'Friday Games',
      date: new Date('2026-09-01T19:00:00Z'),
      location: 'HQ',
      host: { name: 'Ada' },
    },
    ...over,
  } as unknown as Invite;
}

describe('ReminderService.sendDueReminders', () => {
  let inviteRepo: { createQueryBuilder: jest.Mock; save: jest.Mock };
  let mail: { enabled: boolean; sendSessionReminder: jest.Mock };
  let config: { get: jest.Mock };

  const make = () =>
    new ReminderService(inviteRepo as never, mail as never, config as never);

  beforeEach(() => {
    inviteRepo = { createQueryBuilder: jest.fn(), save: jest.fn() };
    mail = { enabled: true, sendSessionReminder: jest.fn() };
    config = { get: jest.fn().mockReturnValue('https://fe.example') };
  });

  it('does nothing when email is not configured', async () => {
    mail.enabled = false;
    const sent = await make().sendDueReminders();
    expect(sent).toBe(0);
    expect(inviteRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('does nothing when FRONTEND_URL is missing (no link to send)', async () => {
    config.get.mockReturnValue(undefined);
    const sent = await make().sendDueReminders();
    expect(sent).toBe(0);
    expect(inviteRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('emails each eligible guest with their invite link and marks them reminded', async () => {
    const invite = eligibleInvite();
    inviteRepo.createQueryBuilder.mockReturnValue(qbReturning([invite]));
    mail.sendSessionReminder.mockResolvedValue(true);
    const now = new Date('2026-09-01T17:00:00Z');

    const sent = await make().sendDueReminders(now);

    expect(sent).toBe(1);
    expect(mail.sendSessionReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pim@example.com',
        guestName: 'Pim',
        sessionName: 'Friday Games',
        inviteUrl: 'https://fe.example/invite/tok-1',
      }),
    );
    // Marked reminded (so the next run skips it).
    expect(invite.reminderSentAt).toBe(now);
    expect(inviteRepo.save).toHaveBeenCalledWith(invite);
  });

  it('does not mark reminded when the send fails (retries next run)', async () => {
    const invite = eligibleInvite();
    inviteRepo.createQueryBuilder.mockReturnValue(qbReturning([invite]));
    mail.sendSessionReminder.mockResolvedValue(false);

    const sent = await make().sendDueReminders();

    expect(sent).toBe(0);
    expect(invite.reminderSentAt).toBeUndefined();
    expect(inviteRepo.save).not.toHaveBeenCalled();
  });
});

describe('ReminderService.sendDueRsvpNudges', () => {
  let inviteRepo: { createQueryBuilder: jest.Mock; save: jest.Mock };
  let mail: { enabled: boolean; sendRsvpNudge: jest.Mock };
  let config: { get: jest.Mock };

  const make = () =>
    new ReminderService(inviteRepo as never, mail as never, config as never);

  beforeEach(() => {
    inviteRepo = { createQueryBuilder: jest.fn(), save: jest.fn() };
    mail = { enabled: true, sendRsvpNudge: jest.fn() };
    config = { get: jest.fn().mockReturnValue('https://fe.example') };
  });

  it('nudges pending guests and marks them so they are not re-nudged', async () => {
    const invite = eligibleInvite({
      rsvpStatus: RsvpStatus.PENDING,
      rsvpReminderSentAt: undefined,
    });
    inviteRepo.createQueryBuilder.mockReturnValue(qbReturning([invite]));
    mail.sendRsvpNudge.mockResolvedValue(true);
    const now = new Date('2026-08-30T19:00:00Z');

    const sent = await make().sendDueRsvpNudges(now);

    expect(sent).toBe(1);
    expect(mail.sendRsvpNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pim@example.com',
        inviteUrl: 'https://fe.example/invite/tok-1',
      }),
    );
    expect((invite as { rsvpReminderSentAt?: Date }).rsvpReminderSentAt).toBe(
      now,
    );
    expect(inviteRepo.save).toHaveBeenCalledWith(invite);
  });

  it('does nothing when email is not configured', async () => {
    mail.enabled = false;
    expect(await make().sendDueRsvpNudges()).toBe(0);
    expect(inviteRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
