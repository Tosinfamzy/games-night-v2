import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds game.statusBeforePause so resuming a paused game can restore the exact
 * prior state (mid-round vs between-rounds) instead of guessing from the round
 * number. Nullable: existing/never-paused games have no prior state.
 *
 * (The auto-generated diff also wanted to rename the hand-authored invite FK +
 * index to TypeORM's hash names — pure cosmetic churn, deliberately omitted.)
 */
export class AddGameStatusBeforePause1785302302112 implements MigrationInterface {
  name = 'AddGameStatusBeforePause1785302302112';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game" ADD "statusBeforePause" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game" DROP COLUMN "statusBeforePause"`,
    );
  }
}
