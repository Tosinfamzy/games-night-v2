import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces one game_result row per game. First de-duplicates any existing rows
 * (keeping one per gameId), then swaps the plain index on game_result.gameId
 * for a UNIQUE one — so a re-completion or a concurrent final-round end can't
 * write a second history record for the same game.
 *
 * (The auto-generated invite-FK rename churn is deliberately omitted.)
 */
export class UniqueGameResultPerGame1785311896218 implements MigrationInterface {
  name = 'UniqueGameResultPerGame1785311896218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep exactly one row per gameId (lowest physical row) before the unique
    // index, or its creation would fail on any pre-existing duplicates.
    await queryRunner.query(
      `DELETE FROM "game_result" a USING "game_result" b WHERE a."gameId" = b."gameId" AND a.ctid > b.ctid`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_52bde66db56be3188de670ff5c"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_52bde66db56be3188de670ff5c" ON "game_result" ("gameId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_52bde66db56be3188de670ff5c"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52bde66db56be3188de670ff5c" ON "game_result" ("gameId")`,
    );
  }
}
