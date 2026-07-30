import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteReminderSentAt1785700000000 implements MigrationInterface {
  name = 'AddInviteReminderSentAt1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tracks whether the day-of reminder email has been sent for an invite, so
    // the reminder cron never emails the same guest twice.
    await queryRunner.query(
      `ALTER TABLE "invite" ADD "reminderSentAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite" DROP COLUMN "reminderSentAt"`,
    );
  }
}
