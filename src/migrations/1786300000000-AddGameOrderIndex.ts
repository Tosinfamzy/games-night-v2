import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `orderIndex` to games — the game's position in the night's run-of-show,
 * set by the Night Builder. Additive with a default of 0 so existing games
 * (and ad-hoc additions) keep working with no ordering.
 */
export class AddGameOrderIndex1786300000000 implements MigrationInterface {
  name = 'AddGameOrderIndex1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game" ADD "orderIndex" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "game" DROP COLUMN "orderIndex"`);
  }
}
