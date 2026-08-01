import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { getErrorMessage } from '../common/utils/error.util';
import { buildEventIcs } from '../common/utils/ics.util';

export interface SessionReminderEmail {
  to: string;
  guestName: string | null;
  sessionName: string;
  date: Date;
  location: string | null;
  hostName: string | null;
  /** The guest's personal invite link (has the one-tap "Join" button). */
  inviteUrl: string;
}

/** Minimal HTML escaping for user-supplied values interpolated into emails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Thin wrapper around Resend for transactional email. When RESEND_API_KEY is
 * unset (local/test/CI) the service is inert — it logs what it *would* send and
 * returns false — so nothing tries to hit the network or 500s. Mirrors the
 * ClerkService pattern.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      'Games Night <onboarding@resend.dev>';
    this.client = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY is not set — emails are inert (logged, not sent)',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Send a day-of reminder. Returns true only when actually delivered. Never
   * throws — a failed send logs and returns false so a batch keeps going.
   */
  async sendSessionReminder(email: SessionReminderEmail): Promise<boolean> {
    const subject = `🎲 ${email.sessionName} is today — tap to join`;

    if (!this.client) {
      this.logger.log(`[inert] would email ${email.to}: "${subject}"`);
      return false;
    }

    try {
      await this.client.emails.send({
        from: this.from,
        to: email.to,
        subject,
        html: this.reminderHtml(email),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send reminder to ${email.to}: ${getErrorMessage(error)}`,
      );
      return false;
    }
  }

  /**
   * Send a "you haven't RSVP'd yet" nudge to a still-pending guest a couple of
   * days before the session. Same delivery/inert semantics as the reminder.
   */
  async sendRsvpNudge(email: SessionReminderEmail): Promise<boolean> {
    const subject = `Are you coming to ${email.sessionName}?`;

    if (!this.client) {
      this.logger.log(`[inert] would nudge ${email.to}: "${subject}"`);
      return false;
    }

    try {
      await this.client.emails.send({
        from: this.from,
        to: email.to,
        subject,
        html: this.nudgeHtml(email),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send RSVP nudge to ${email.to}: ${getErrorMessage(error)}`,
      );
      return false;
    }
  }

  /**
   * Confirm a guest's RSVP the moment they say yes — the event details, a
   * one-tap "Join" link, and a calendar (.ics) attachment so there's no excuse
   * to forget. Same delivery/inert semantics as the reminder.
   */
  async sendRsvpConfirmation(email: SessionReminderEmail): Promise<boolean> {
    const subject = `You're in for ${email.sessionName} 🎉`;

    if (!this.client) {
      this.logger.log(`[inert] would confirm ${email.to}: "${subject}"`);
      return false;
    }

    try {
      const ics = buildEventIcs({
        title: email.sessionName,
        start: email.date,
        location: email.location,
        description: email.hostName
          ? `Games night hosted by ${email.hostName}.`
          : 'Games night',
        url: email.inviteUrl,
        uid: email.inviteUrl,
      });
      await this.client.emails.send({
        from: this.from,
        to: email.to,
        subject,
        html: this.confirmationHtml(email),
        attachments: [
          {
            filename: 'games-night.ics',
            content: Buffer.from(ics).toString('base64'),
            contentType: 'text/calendar',
          },
        ],
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send RSVP confirmation to ${email.to}: ${getErrorMessage(error)}`,
      );
      return false;
    }
  }

  private confirmationHtml(e: SessionReminderEmail): string {
    const greeting = e.guestName ? `Hi ${escapeHtml(e.guestName)},` : 'Hi,';
    const when = e.date.toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    const host = e.hostName ? ` hosted by ${escapeHtml(e.hostName)}` : '';

    return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1b19;">
  <p style="font-size:16px;">${greeting}</p>
  <p style="font-size:16px;">
    You're all set for <strong>${escapeHtml(e.sessionName)}</strong>${host} — ${escapeHtml(when)}. 🎉
  </p>
  ${this.locationLine(e.location)}
  <p style="font-size:15px;color:#555;">We've attached a calendar invite so you don't forget. On the night, tap below to jump in — no code needed:</p>
  <a href="${e.inviteUrl}"
     style="display:inline-block;margin:16px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;">
    🎮 Join the game night
  </a>
  <p style="font-size:13px;color:#888;">Or open this link: <br><a href="${e.inviteUrl}" style="color:#4f46e5;">${e.inviteUrl}</a></p>
</div>`.trim();
  }

  private reminderHtml(e: SessionReminderEmail): string {
    const greeting = e.guestName ? `Hi ${escapeHtml(e.guestName)},` : 'Hi,';
    const when = e.date.toLocaleString('en-GB', {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    const host = e.hostName ? ` by ${escapeHtml(e.hostName)}` : '';

    return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1b19;">
  <p style="font-size:16px;">${greeting}</p>
  <p style="font-size:16px;">
    <strong>${escapeHtml(e.sessionName)}</strong> is happening today${host} — ${escapeHtml(when)}. Ready to play?
  </p>
  ${this.locationLine(e.location)}
  <a href="${e.inviteUrl}"
     style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;">
    🎮 Join the game night
  </a>
  <p style="font-size:13px;color:#888;">Or open this link: <br><a href="${e.inviteUrl}" style="color:#4f46e5;">${e.inviteUrl}</a></p>
</div>`.trim();
  }

  private nudgeHtml(e: SessionReminderEmail): string {
    const greeting = e.guestName ? `Hi ${escapeHtml(e.guestName)},` : 'Hi,';
    const when = e.date.toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    const host = e.hostName ? ` ${escapeHtml(e.hostName)}'s` : 'the';

    return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1b19;">
  <p style="font-size:16px;">${greeting}</p>
  <p style="font-size:16px;">
    You're invited to ${host} <strong>${escapeHtml(e.sessionName)}</strong> — ${escapeHtml(when)}. Can you make it?
  </p>
  ${this.locationLine(e.location)}
  <a href="${e.inviteUrl}"
     style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;">
    Let them know →
  </a>
  <p style="font-size:13px;color:#888;">Or open this link: <br><a href="${e.inviteUrl}" style="color:#4f46e5;">${e.inviteUrl}</a></p>
</div>`.trim();
  }

  /** A 📍 location line linking to Google Maps, or '' when there's no location. */
  private locationLine(location: string | null): string {
    if (!location) return '';
    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    return `<p style="margin:4px 0;color:#555;">📍 <a href="${maps}" style="color:#4f46e5;">${escapeHtml(location)}</a></p>`;
  }
}
