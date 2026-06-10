import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGenerationTaskDisplayName1781160000000 implements MigrationInterface {
  name = 'AddGenerationTaskDisplayName1781160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "generation_tasks" ADD "display_name" character varying(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "generation_tasks" DROP COLUMN "display_name"`);
  }
}
