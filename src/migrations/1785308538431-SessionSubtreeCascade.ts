import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the whole session subtree cascade-delete, so removing a session (or a
 * player/team) no longer 500s on a foreign-key violation:
 *   session → game / team / player / game_result / messages  : CASCADE
 *   messages → player                                        : CASCADE
 *   score → player                                           : SET NULL
 *   game_result → winningTeam                                : SET NULL
 *
 * (The join-table team_players_player.playerId FK stays NO ACTION — TypeORM's
 * synchronize creates it that way too, so instead of drifting prod from test we
 * detach a player from their teams in application code before deleting.
 * The auto-generated invite-FK rename churn is deliberately omitted.)
 */
export class SessionSubtreeCascade1785308538431 implements MigrationInterface {
  name = 'SessionSubtreeCascade1785308538431';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_66f5fb8ee865712db248080d5ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_66f5fb8ee865712db248080d5ea" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" DROP CONSTRAINT "FK_6aca7c561753fc5148d8ef5d703"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD CONSTRAINT "FK_6aca7c561753fc5148d8ef5d703" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" DROP CONSTRAINT "FK_8d7a2a5d1021fd73c6879ccf753"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_8d7a2a5d1021fd73c6879ccf753" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" DROP CONSTRAINT "FK_06c078288dfb5c550cde0398359"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" ADD CONSTRAINT "FK_06c078288dfb5c550cde0398359" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_97adbd387466dabca2b30255103"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_97adbd387466dabca2b30255103" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_93712446fa38307fbe59379eb63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_93712446fa38307fbe59379eb63" FOREIGN KEY ("winningTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_066163c46cda7e8187f96bc87a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_066163c46cda7e8187f96bc87a0" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_bc3435af17b8c44f5f22134cc04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_bc3435af17b8c44f5f22134cc04" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const revert: Array<[string, string, string, string]> = [
      ['messages', 'FK_bc3435af17b8c44f5f22134cc04', 'playerId', 'player'],
      ['messages', 'FK_066163c46cda7e8187f96bc87a0', 'sessionId', 'session'],
      [
        'game_result',
        'FK_93712446fa38307fbe59379eb63',
        'winningTeamId',
        'team',
      ],
      ['game_result', 'FK_97adbd387466dabca2b30255103', 'sessionId', 'session'],
      ['game', 'FK_06c078288dfb5c550cde0398359', 'sessionId', 'session'],
      ['team', 'FK_8d7a2a5d1021fd73c6879ccf753', 'sessionId', 'session'],
      ['player', 'FK_6aca7c561753fc5148d8ef5d703', 'sessionId', 'session'],
      ['score', 'FK_66f5fb8ee865712db248080d5ea', 'playerId', 'player'],
    ];
    for (const [table, fk, col, ref] of revert) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("${col}") REFERENCES "${ref}"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    }
  }
}
