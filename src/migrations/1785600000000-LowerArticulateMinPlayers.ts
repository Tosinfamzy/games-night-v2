import { MigrationInterface, QueryRunner } from 'typeorm';

export class LowerArticulateMinPlayers1785600000000 implements MigrationInterface {
  name = 'LowerArticulateMinPlayers1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Articulate was seeded at minPlayers 4, which blocks small-group / 2-player
    // (2 teams of 1) play. The catalog is read-only over the API and the seeder
    // never overwrites an existing row, so update the live row here. (New games
    // like UNO are still added idempotently by the seeder on boot.)
    await queryRunner.query(
      `UPDATE "game_library" SET "minPlayers" = 2 WHERE "name" = 'Articulate' AND "minPlayers" = 4`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "game_library" SET "minPlayers" = 4 WHERE "name" = 'Articulate' AND "minPlayers" = 2`,
    );
  }
}
