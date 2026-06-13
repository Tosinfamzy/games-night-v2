import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1781332343618 implements MigrationInterface {
  name = 'InitialSchema1781332343618';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Baseline guard: on databases whose schema was already created by the old
    // `synchronize` behaviour (e.g. the existing production DB), the tables
    // already exist. Skip recreation and let TypeORM simply record this
    // migration as applied, so the cutover needs no manual SQL. On a fresh DB
    // this guard is false and the full schema is created below.
    if (await queryRunner.hasTable('session')) {
      return;
    }
    await queryRunner.query(
      `CREATE TABLE "score" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "points" integer NOT NULL, "isBonus" boolean NOT NULL DEFAULT false, "roundNumber" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "gameId" uuid, "playerId" uuid, "teamId" uuid, CONSTRAINT "PK_1770f42c61451103f5514134078" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."player_status_enum" AS ENUM('joined', 'ready', 'playing', 'disconnected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "player" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "isGuest" boolean NOT NULL DEFAULT false, "userId" character varying, "status" "public"."player_status_enum" NOT NULL DEFAULT 'joined', "lastConnectedAt" TIMESTAMP, "isOnline" boolean NOT NULL DEFAULT false, "currentSocketId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" uuid, CONSTRAINT "PK_65edadc946a7faf4b638d5e8885" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "team" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "color" character varying, "position" integer NOT NULL DEFAULT '1', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "gameId" uuid, "sessionId" uuid, CONSTRAINT "PK_f57d8293406df4af348402e4b74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."game_library_difficulty_enum" AS ENUM('Easy', 'Medium', 'Hard')`,
    );
    await queryRunner.query(
      `CREATE TABLE "game_library" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text NOT NULL, "minPlayers" integer NOT NULL, "maxPlayers" integer NOT NULL, "estimatedDuration" integer NOT NULL, "difficulty" "public"."game_library_difficulty_enum" NOT NULL DEFAULT 'Easy', "categories" text NOT NULL, "equipment" character varying, "rules" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e2377f6b792d315a0a320065e60" UNIQUE ("name"), CONSTRAINT "PK_c18940f1bc2a14c91ed6dc08bea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."game_status_enum" AS ENUM('PENDING', 'READY_TO_START', 'IN_PROGRESS', 'ROUND_IN_PROGRESS', 'ROUND_ENDED', 'WAITING_FOR_TEAMS', 'PAUSED', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "game" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "status" "public"."game_status_enum" NOT NULL DEFAULT 'PENDING', "currentRound" integer NOT NULL DEFAULT '0', "maxRounds" integer NOT NULL DEFAULT '1', "currentTurnTeamId" character varying, "turnStartedAt" TIMESTAMP, "turnTimeLimit" integer, "winnerId" character varying, "completedAt" TIMESTAMP, "results" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" uuid, "gameLibraryId" uuid, CONSTRAINT "PK_352a30652cd352f552fef73dec5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."session_status_enum" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "date" TIMESTAMP WITH TIME ZONE NOT NULL, "location" character varying, "status" "public"."session_status_enum" NOT NULL DEFAULT 'SCHEDULED', "joinCode" character varying(6) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "hostId" uuid, CONSTRAINT "UQ_2a0c24d4bacc7926d99516419bc" UNIQUE ("joinCode"), CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "games_master" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "hostCode" character varying(6), "userId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1e3f94472b1c72119ea29bfd68e" UNIQUE ("hostCode"), CONSTRAINT "PK_3a526d115929cc482991b9b8dbf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('games_master', 'player')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'player', "avatarUrl" character varying, "isEmailVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "gamesMasterProfileId" uuid, "playerProfileId" uuid, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "REL_3adcc37745fce479cf0aaa303a" UNIQUE ("gamesMasterProfileId"), CONSTRAINT "REL_67e732a119d3e4a113657b47b8" UNIQUE ("playerProfileId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "game_result" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameName" character varying NOT NULL, "winningTeamName" character varying, "finalScores" jsonb NOT NULL, "completedAt" TIMESTAMP NOT NULL, "durationMinutes" integer NOT NULL, "totalRounds" integer NOT NULL, "teamCount" integer NOT NULL, "isTied" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "gameId" uuid, "sessionId" uuid, "winningTeamId" uuid, CONSTRAINT "PK_0f05afdea1542af63c3027f7534" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_type_enum" AS ENUM('text', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "type" "public"."messages_type_enum" NOT NULL DEFAULT 'text', "isEdited" boolean NOT NULL DEFAULT false, "editedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" uuid, "playerId" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
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
      `CREATE TABLE "team_players_player" ("teamId" uuid NOT NULL, "playerId" uuid NOT NULL, CONSTRAINT "PK_30ad7c7427cb452e63ff4d4f9a0" PRIMARY KEY ("teamId", "playerId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03530e45522b82c6ae46d825dd" ON "team_players_player" ("teamId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a5a5ca467eb43bf810ce32a119" ON "team_players_player" ("playerId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_0778913dcc5349f3bcb0ebeab8c" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_66f5fb8ee865712db248080d5ea" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" ADD CONSTRAINT "FK_3f446d741687acc589389ba1711" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" ADD CONSTRAINT "FK_6aca7c561753fc5148d8ef5d703" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_2dad5b2c6156806e8fd59bf37b5" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "FK_8d7a2a5d1021fd73c6879ccf753" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" ADD CONSTRAINT "FK_06c078288dfb5c550cde0398359" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" ADD CONSTRAINT "FK_27923a496376d6a36f208d3ec74" FOREIGN KEY ("gameLibraryId") REFERENCES "game_library"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_f87d0e39c746e717783510f20f2" FOREIGN KEY ("hostId") REFERENCES "games_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_3adcc37745fce479cf0aaa303ab" FOREIGN KEY ("gamesMasterProfileId") REFERENCES "games_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_67e732a119d3e4a113657b47b8d" FOREIGN KEY ("playerProfileId") REFERENCES "player"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_52bde66db56be3188de670ff5c3" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_97adbd387466dabca2b30255103" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" ADD CONSTRAINT "FK_93712446fa38307fbe59379eb63" FOREIGN KEY ("winningTeamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_066163c46cda7e8187f96bc87a0" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_bc3435af17b8c44f5f22134cc04" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" ADD CONSTRAINT "FK_7b3ce40b4ef543d4e015b81df6f" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" ADD CONSTRAINT "FK_45045650ab02d5ff1a5b387a76b" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_players_player" ADD CONSTRAINT "FK_03530e45522b82c6ae46d825dd1" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_players_player" ADD CONSTRAINT "FK_a5a5ca467eb43bf810ce32a119d" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_players_player" DROP CONSTRAINT "FK_a5a5ca467eb43bf810ce32a119d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_players_player" DROP CONSTRAINT "FK_03530e45522b82c6ae46d825dd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" DROP CONSTRAINT "FK_45045650ab02d5ff1a5b387a76b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_teams_team" DROP CONSTRAINT "FK_7b3ce40b4ef543d4e015b81df6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_bc3435af17b8c44f5f22134cc04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_066163c46cda7e8187f96bc87a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_93712446fa38307fbe59379eb63"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_97adbd387466dabca2b30255103"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_result" DROP CONSTRAINT "FK_52bde66db56be3188de670ff5c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_67e732a119d3e4a113657b47b8d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_3adcc37745fce479cf0aaa303ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_f87d0e39c746e717783510f20f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" DROP CONSTRAINT "FK_27923a496376d6a36f208d3ec74"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game" DROP CONSTRAINT "FK_06c078288dfb5c550cde0398359"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" DROP CONSTRAINT "FK_8d7a2a5d1021fd73c6879ccf753"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" DROP CONSTRAINT "FK_2dad5b2c6156806e8fd59bf37b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player" DROP CONSTRAINT "FK_6aca7c561753fc5148d8ef5d703"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_3f446d741687acc589389ba1711"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_66f5fb8ee865712db248080d5ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score" DROP CONSTRAINT "FK_0778913dcc5349f3bcb0ebeab8c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a5a5ca467eb43bf810ce32a119"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03530e45522b82c6ae46d825dd"`,
    );
    await queryRunner.query(`DROP TABLE "team_players_player"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45045650ab02d5ff1a5b387a76"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7b3ce40b4ef543d4e015b81df6"`,
    );
    await queryRunner.query(`DROP TABLE "player_teams_team"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_type_enum"`);
    await queryRunner.query(`DROP TABLE "game_result"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "games_master"`);
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TYPE "public"."session_status_enum"`);
    await queryRunner.query(`DROP TABLE "game"`);
    await queryRunner.query(`DROP TYPE "public"."game_status_enum"`);
    await queryRunner.query(`DROP TABLE "game_library"`);
    await queryRunner.query(
      `DROP TYPE "public"."game_library_difficulty_enum"`,
    );
    await queryRunner.query(`DROP TABLE "team"`);
    await queryRunner.query(`DROP TABLE "player"`);
    await queryRunner.query(`DROP TYPE "public"."player_status_enum"`);
    await queryRunner.query(`DROP TABLE "score"`);
  }
}
