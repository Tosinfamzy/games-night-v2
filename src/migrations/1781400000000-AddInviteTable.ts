import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteTable1781400000000 implements MigrationInterface {
  name = 'AddInviteTable1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."invite_rsvpstatus_enum" AS ENUM('PENDING', 'GOING', 'MAYBE', 'NOT_GOING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invite" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying, "email" character varying, "inviteToken" character varying NOT NULL, "rsvpStatus" "public"."invite_rsvpstatus_enum" NOT NULL DEFAULT 'PENDING', "plusOnes" integer NOT NULL DEFAULT '0', "note" text, "playerId" uuid, "respondedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" uuid, CONSTRAINT "UQ_invite_inviteToken" UNIQUE ("inviteToken"), CONSTRAINT "PK_invite_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invite_sessionId" ON "invite" ("sessionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" ADD CONSTRAINT "FK_invite_session" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite" DROP CONSTRAINT "FK_invite_session"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_invite_sessionId"`);
    await queryRunner.query(`DROP TABLE "invite"`);
    await queryRunner.query(`DROP TYPE "public"."invite_rsvpstatus_enum"`);
  }
}
