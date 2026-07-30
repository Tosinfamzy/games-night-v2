import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService (inert when unconfigured)', () => {
  const makeConfig = (values: Record<string, string | undefined>) =>
    ({ get: (k: string) => values[k] }) as unknown as ConfigService;

  it('is disabled and inert when RESEND_API_KEY is unset', async () => {
    const mail = new MailService(makeConfig({}));
    expect(mail.enabled).toBe(false);

    // Inert send: never throws, reports not-delivered.
    const delivered = await mail.sendSessionReminder({
      to: 'guest@example.com',
      guestName: 'Pim',
      sessionName: 'Friday Games',
      date: new Date('2026-09-01T19:00:00Z'),
      location: null,
      hostName: 'Ada',
      inviteUrl: 'https://fe.example/invite/tok',
    });
    expect(delivered).toBe(false);
  });

  it('is enabled when an API key is present', () => {
    const mail = new MailService(makeConfig({ RESEND_API_KEY: 're_test' }));
    expect(mail.enabled).toBe(true);
  });
});
