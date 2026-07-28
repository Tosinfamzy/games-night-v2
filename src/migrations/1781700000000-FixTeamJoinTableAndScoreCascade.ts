import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two team data-integrity fixes:
 *  1. Drop the duplicate, always-empty `player_teams_team` join table. Both
 *     Team.players and Player.teams declared @JoinTable, so TypeORM created two
 *     join tables; all writes went through `team_players_player`, leaving
 *     `player_teams_team` empty and `player.teams` unreadable. Player.teams is
 *     now the inverse side (owning @JoinTable stays on Team.players).
 *  2. Make the score -> team FK ON DELETE CASCADE so dissolving/clearing/
 *     re-forming teams after a round is scored no longer fails with an FK
 *     violation (the team's scores are removed with it).
 */
export class FixTeamJoinTableAndScoreCascade1781700000000 implements MigrationInterface {
  name = 'FixTeamJoinTableAndScoreCascade1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the duplicate empty join table.
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" DROP CONSTRAINT "FK_7b3ce40b4ef543d4e015b81df6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" DROP CONSTRAINT "FK_45045650ab02d5ff1a5b387a76b"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_7b3ce40b4ef543d4e015b81df6"`);
    await queryRunner.query(`DROP INDEX "IDX_45045650ab02d5ff1a5b387a76"`);
    await queryRunner.query(`DROP TABLE "player_teams_team"`);

    // 2. score -> team FK: NO ACTION -> CASCADE.
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_3f446d741687acc589389ba1711"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_3f446d741687acc589389ba1711" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the score FK to NO ACTION.
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_3f446d741687acc589389ba1711"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_3f446d741687acc589389ba1711" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Recreate the duplicate join table (empty, as it always was).
    await queryRunner.query(
      `CREATE TABLE "player_teams_team" ("playerId" uuid NOT NULL, "teamId" uuid NOT NULL, CONSTRAINT "PK_add0edddfa87d61fe04a4c41558" PRIMARY KEY ("playerId", "teamId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7b3ce40b4ef543d4e015b81df6" ON "player_teams_team" ("playerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45045650ab02d5ff1a5b387a76" ON "player_teams_team" ("teamId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" ADD CONSTRAINT "FK_7b3ce40b4ef543d4e015b81df6f" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" ADD CONSTRAINT "FK_45045650ab02d5ff1a5b387a76b" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
