import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes score, team and game_result cascade-delete with their game, so removing
 * a game (session cleanup) no longer 500s on a foreign-key violation when the
 * game has any play data.
 *
 * (The auto-generated diff also wanted to rename the hand-authored invite FK +
 * index to TypeORM's hash names — pure cosmetic churn, deliberately omitted.)
 */
export class GameRemovalCascade1785305527195 implements MigrationInterface {
  name = 'GameRemovalCascade1785305527195';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_0778913dcc5349f3bcb0ebeab8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_0778913dcc5349f3bcb0ebeab8c" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" DROP CONSTRAINT "FK_2dad5b2c6156806e8fd59bf37b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_2dad5b2c6156806e8fd59bf37b5" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_52bde66db56be3188de670ff5c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_52bde66db56be3188de670ff5c3" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_52bde66db56be3188de670ff5c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_52bde66db56be3188de670ff5c3" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" DROP CONSTRAINT "FK_2dad5b2c6156806e8fd59bf37b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_2dad5b2c6156806e8fd59bf37b5" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_0778913dcc5349f3bcb0ebeab8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_0778913dcc5349f3bcb0ebeab8c" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
