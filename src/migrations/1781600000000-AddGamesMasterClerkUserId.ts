import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGamesMasterClerkUserId1781600000000 implements MigrationInterface {
  name = 'AddGamesMasterClerkUserId1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable: existing GMs (created via the public pick-from-list flow) have
    // no Clerk identity; only GMs that sign in via Clerk get one. UNIQUE so a
    // Clerk user maps to exactly one GamesMaster.
    await queryRunner.query(
      `ALTER TABLE "games_master" ADD "clerkUserId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "games_master" ADD CONSTRAINT "UQ_games_master_clerkUserId" UNIQUE ("clerkUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games_master" DROP CONSTRAINT "UQ_games_master_clerkUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games_master" DROP COLUMN "clerkUserId"`,
    );
  }
}
