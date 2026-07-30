import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteRsvpReminderSentAt1785800000000
  implements MigrationInterface
{
  name = 'AddInviteRsvpReminderSentAt1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tracks the "you haven't RSVP'd yet" nudge, sent to still-pending guests a
    // couple of days out — separate from the day-of reminder (reminderSentAt).
    await queryRunner.query(
      `ALTER TABLE "invite" ADD "rsvpReminderSentAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite" DROP COLUMN "rsvpReminderSentAt"`,
    );
  }
}
