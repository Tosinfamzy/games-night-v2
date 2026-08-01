import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Store the names of a guest's plus-ones (in order) so check-in can create
 * real, named players instead of anonymous "Milly +1"/"+2". jsonb string array;
 * defaults to [] for existing invites (they simply have no plus-one names).
 */
export class AddInvitePlusOneNames1785960000000 implements MigrationInterface {
  name = 'AddInvitePlusOneNames1785960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite" ADD "plusOneNames" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "plusOneNames"`);
  }
}
