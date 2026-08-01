import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionLocationUrl1786100000000 implements MigrationInterface {
  name = 'AddSessionLocationUrl1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" ADD "locationUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "locationUrl"`);
  }
}
