import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionInviteMessage1785400000000 implements MigrationInterface {
  name = 'AddSessionInviteMessage1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Host-authored invite message: default share text for the RSVP link and
    // the greeting on the public RSVP page. Nullable — existing sessions have
    // none until the host writes one.
    await queryRunner.query(`ALTER TABLE "session" ADD "inviteMessage" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" DROP COLUMN "inviteMessage"`,
    );
  }
}
