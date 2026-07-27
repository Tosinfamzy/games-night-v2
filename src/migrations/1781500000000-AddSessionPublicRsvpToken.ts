import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionPublicRsvpToken1781500000000 implements MigrationInterface {
  name = 'AddSessionPublicRsvpToken1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add nullable, backfill existing rows with a unique token, then enforce
    // NOT NULL + UNIQUE so existing sessions get a working shareable link too.
    await queryRunner.query(`ALTER TABLE "session" ADD "publicRsvpToken" uuid`);
    await queryRunner.query(
      `UPDATE "session" SET "publicRsvpToken" = uuid_generate_v4() WHERE "publicRsvpToken" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "publicRsvpToken" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "UQ_session_publicRsvpToken" UNIQUE ("publicRsvpToken")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "UQ_session_publicRsvpToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" DROP COLUMN "publicRsvpToken"`,
    );
  }
}
