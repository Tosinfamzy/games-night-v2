import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionHostMessage1786000000000 implements MigrationInterface {
  name = 'AddSessionHostMessage1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" ADD "hostMessage" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "hostMessage"`);
  }
}
