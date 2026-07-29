import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniquePlayerNamePerSession1785500000000 implements MigrationInterface {
  name = 'AddUniquePlayerNamePerSession1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Close the joinSession check-then-create race with a DB-level guarantee:
    // at most one player per (session, name).
    //
    // First, non-destructively disambiguate any duplicates a previous race may
    // have created — append a short id fragment to every row except the earliest
    // in each (sessionId, name) group — so the unique index can be built without
    // deleting anyone (players may be on teams / have scores).
    await queryRunner.query(`
      UPDATE "player" p
      SET "name" = p."name" || ' #' || left(p."id"::text, 8)
      WHERE EXISTS (
        SELECT 1 FROM "player" q
        WHERE q."sessionId" = p."sessionId"
          AND q."name" = p."name"
          AND q."createdAt" < p."createdAt"
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_player_session_name" ON "player" ("sessionId", "name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The name disambiguation is intentionally not reversed (no data to restore).
    await queryRunner.query(`DROP INDEX "public"."UQ_player_session_name"`);
  }
}
