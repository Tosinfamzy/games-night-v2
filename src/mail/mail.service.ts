import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { getErrorMessage } from '../common/utils/error.util';

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

  private reminderHtml(e: SessionReminderEmail): string {
    const greeting = e.guestName ? `Hi ${escapeHtml(e.guestName)},` : 'Hi,';
    const when = e.date.toLocaleString('en-GB', {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
    const host = e.hostName ? ` by ${escapeHtml(e.hostName)}` : '';
    const location = e.location
      ? `<p style="margin:4px 0;color:#555;">📍 ${escapeHtml(e.location)}</p>`
      : '';

    return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1b19;">
  <p style="font-size:16px;">${greeting}</p>
  <p style="font-size:16px;">
    <strong>${escapeHtml(e.sessionName)}</strong> is happening today${host} — ${escapeHtml(when)}. Ready to play?
  </p>
  ${location}
  <a href="${e.inviteUrl}"
     style="display:inline-block;margin:20px 0;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;">
    🎮 Join the game night
  </a>
  <p style="font-size:13px;color:#888;">Or open this link: <br><a href="${e.inviteUrl}" style="color:#4f46e5;">${e.inviteUrl}</a></p>
</div>`.trim();
  }
}
