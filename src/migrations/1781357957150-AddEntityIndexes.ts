import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEntityIndexes1781357957150 implements MigrationInterface {
  name = 'AddEntityIndexes1781357957150';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_0778913dcc5349f3bcb0ebeab8" ON "score" ("gameId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_66f5fb8ee865712db248080d5e" ON "score" ("playerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f446d741687acc589389ba171" ON "score" ("teamId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_59b28b255b2d3e4dcb1a6a9e87" ON "player" ("currentSocketId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6aca7c561753fc5148d8ef5d70" ON "player" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2dad5b2c6156806e8fd59bf37b" ON "team" ("gameId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d7a2a5d1021fd73c6879ccf75" ON "team" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06c078288dfb5c550cde039835" ON "game" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27923a496376d6a36f208d3ec7" ON "game" ("gameLibraryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52bde66db56be3188de670ff5c" ON "game_result" ("gameId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97adbd387466dabca2b3025510" ON "game_result" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93712446fa38307fbe59379eb6" ON "game_result" ("winningTeamId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_066163c46cda7e8187f96bc87a" ON "messages" ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc3435af17b8c44f5f22134cc0" ON "messages" ("playerId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc3435af17b8c44f5f22134cc0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_066163c46cda7e8187f96bc87a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_93712446fa38307fbe59379eb6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97adbd387466dabca2b3025510"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_52bde66db56be3188de670ff5c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_27923a496376d6a36f208d3ec7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_06c078288dfb5c550cde039835"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d7a2a5d1021fd73c6879ccf75"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2dad5b2c6156806e8fd59bf37b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6aca7c561753fc5148d8ef5d70"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_59b28b255b2d3e4dcb1a6a9e87"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3f446d741687acc589389ba171"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_66f5fb8ee865712db248080d5e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0778913dcc5349f3bcb0ebeab8"`,
    );
  }
}
