import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-player scoring support to games:
 * - `scoreMode` ('team' | 'individual'), defaulting existing games to 'team'
 *   so behaviour is unchanged.
 * - `currentTurnPlayerId`, the individual-mode counterpart to
 *   `currentTurnTeamId`.
 * Both are additive; the Score table already carries an optional playerId.
 */
export class AddGameScoreMode1785900000000 implements MigrationInterface {
  name = 'AddGameScoreMode1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game" ADD "scoreMode" character varying NOT NULL DEFAULT 'team'`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" ADD "currentTurnPlayerId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game" DROP COLUMN "currentTurnPlayerId"`,
    );
    await queryRunner.query(`ALTER TABLE "game" DROP COLUMN "scoreMode"`);
  }
}
