import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Invite } from './invite.entity';
import { RsvpStatus } from './enums/rsvp-status.enum';
import { SessionStatus } from '../session/enums/session-status.enum';
import { MailService } from '../mail/mail.service';
import { getErrorMessage } from '../common/utils/error.util';

/** Email confirmed guests this many hours before the session starts. */
const REMINDER_LEAD_HOURS = 3;

/** Nudge still-pending guests when the session is within this many hours. */
const RSVP_NUDGE_LEAD_HOURS = 48;

/**
 * Sends a one-off day-of reminder email to guests who said they're coming, a few
 * hours before the session starts. Runs on a cron; each invite is reminded at
 * most once (guarded by reminderSentAt), and only when email is configured.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron('*/15 * * * *')
  async handleCron(): Promise<void> {
    try {
      const reminders = await this.sendDueReminders();
      if (reminders > 0)
        this.logger.log(`Sent ${reminders} day-of reminder(s)`);

      const nudges = await this.sendDueRsvpNudges();
      if (nudges > 0) this.logger.log(`Sent ${nudges} RSVP nudge(s)`);
    } catch (error) {
      this.logger.error(`Reminder run failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Email every guest who is GOING/MAYBE (with an email, not yet reminded) for a
   * SCHEDULED session starting within the lead window. Returns how many were
   * actually sent. Public so it can be unit-tested / triggered directly.
   */
  async sendDueReminders(now: Date = new Date()): Promise<number> {
    // No email configured, or no frontend base URL to build the invite link:
    // do nothing (invites stay un-reminded and are retried once it's set up).
    if (!this.mail.enabled) return 0;
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      this.logger.warn('FRONTEND_URL not set — skipping reminders (no link)');
      return 0;
    }

    const windowEnd = new Date(now.getTime() + REMINDER_LEAD_HOURS * 3600_000);

    const invites = await this.inviteRepo
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.session', 'session')
      .leftJoinAndSelect('session.host', 'host')
      .where('invite.reminderSentAt IS NULL')
      .andWhere('invite.email IS NOT NULL')
      .andWhere('invite.rsvpStatus IN (:...statuses)', {
        statuses: [RsvpStatus.GOING, RsvpStatus.MAYBE],
      })
      .andWhere('session.status = :status', {
        status: SessionStatus.SCHEDULED,
      })
      .andWhere('session.date > :now', { now })
      .andWhere('session.date <= :windowEnd', { windowEnd })
      .getMany();

    let sentCount = 0;
    for (const invite of invites) {
      if (!invite.session || !invite.email) continue;

      const sent = await this.mail.sendSessionReminder({
        to: invite.email,
        guestName: invite.name ?? null,
        sessionName: invite.session.name,
        date: invite.session.date,
        location: invite.session.location ?? null,
        hostName: invite.session.host?.name ?? null,
        inviteUrl: `${frontendUrl.replace(/\/$/, '')}/invite/${invite.inviteToken}`,
      });

      // Only mark reminded on a real send, so a transient failure retries next
      // run rather than silently swallowing the reminder.
      if (sent) {
        invite.reminderSentAt = now;
        await this.inviteRepo.save(invite);
        sentCount += 1;
      }
    }

    return sentCount;
  }

  /**
   * Nudge still-pending guests (with an email, not yet nudged) whose SCHEDULED
   * session starts within the RSVP-nudge window. Returns how many were sent.
   */
  async sendDueRsvpNudges(now: Date = new Date()): Promise<number> {
    if (!this.mail.enabled) return 0;
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) return 0;

    const windowEnd = new Date(
      now.getTime() + RSVP_NUDGE_LEAD_HOURS * 3600_000,
    );

    const invites = await this.inviteRepo
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.session', 'session')
      .leftJoinAndSelect('session.host', 'host')
      .where('invite.rsvpReminderSentAt IS NULL')
      .andWhere('invite.email IS NOT NULL')
      .andWhere('invite.rsvpStatus = :status', { status: RsvpStatus.PENDING })
      .andWhere('session.status = :sessionStatus', {
        sessionStatus: SessionStatus.SCHEDULED,
      })
      .andWhere('session.date > :now', { now })
      .andWhere('session.date <= :windowEnd', { windowEnd })
      .getMany();

    let sentCount = 0;
    for (const invite of invites) {
      if (!invite.session || !invite.email) continue;

      const sent = await this.mail.sendRsvpNudge({
        to: invite.email,
        guestName: invite.name ?? null,
        sessionName: invite.session.name,
        date: invite.session.date,
        location: invite.session.location ?? null,
        hostName: invite.session.host?.name ?? null,
        inviteUrl: `${frontendUrl.replace(/\/$/, '')}/invite/${invite.inviteToken}`,
      });

      if (sent) {
        invite.rsvpReminderSentAt = now;
        await this.inviteRepo.save(invite);
        sentCount += 1;
      }
    }

    return sentCount;
  }
}
