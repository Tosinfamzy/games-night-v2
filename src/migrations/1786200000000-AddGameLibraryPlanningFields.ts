import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds Night Builder planning metadata to the game library:
 * - `format` (how the game is run: free_for_all | all_teams | round_robin | trio)
 * - `recommendedRounds` (suggested rounds/waves)
 * - `playersPerRound` (how many play at once; null = everyone)
 * - `minTeams` (minimum teams the game needs; null = no requirement)
 * - `winnerBonusPoints` (flat winner points instead of placement; null = placement)
 *
 * Columns are additive with safe defaults (`all_teams`, 1 round, nulls) so
 * existing rows keep working. The UPDATEs then backfill the seeded catalog by
 * name to match how these games are actually run (mirrors game-library.seed.ts).
 */
export class AddGameLibraryPlanningFields1786200000000 implements MigrationInterface {
  name = 'AddGameLibraryPlanningFields1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_library" ADD "format" character varying NOT NULL DEFAULT 'all_teams'`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" ADD "recommendedRounds" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" ADD "playersPerRound" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" ADD "minTeams" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" ADD "winnerBonusPoints" integer`,
    );

    // Backfill the seeded catalog by name (rows not listed keep the defaults).
    await queryRunner.query(
      `UPDATE "game_library" SET "format" = 'free_for_all' WHERE "name" IN ('UNO', 'Cards Against Humanity', 'UNO No Mercy', 'Musical Cups')`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "winnerBonusPoints" = 5 WHERE "name" = 'Musical Cups'`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "format" = 'round_robin' WHERE "name" = 'Flippy Cup → Tic-Tac-Toe'`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "format" = 'trio', "playersPerRound" = 3 WHERE "name" = 'Blind, Deaf & Mute'`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "recommendedRounds" = 3, "playersPerRound" = 6 WHERE "name" = 'Head, Shoulders, Knees & Cup'`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "recommendedRounds" = 5, "playersPerRound" = 3 WHERE "name" = 'Karaoke — Keep Singing'`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "recommendedRounds" = 3 WHERE "name" = 'Candle Blow'`,
    );
    await queryRunner.query(
      `UPDATE "game_library" SET "recommendedRounds" = 3, "playersPerRound" = 3, "minTeams" = 3 WHERE "name" = 'Heavy Drinkers'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_library" DROP COLUMN "winnerBonusPoints"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" DROP COLUMN "minTeams"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" DROP COLUMN "playersPerRound"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_library" DROP COLUMN "recommendedRounds"`,
    );
    await queryRunner.query(`ALTER TABLE "game_library" DROP COLUMN "format"`);
  }
}
