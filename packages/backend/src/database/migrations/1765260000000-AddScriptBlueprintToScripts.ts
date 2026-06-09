import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScriptBlueprintToScripts1765260000000 implements MigrationInterface {
  name = 'AddScriptBlueprintToScripts1765260000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scripts" ADD COLUMN "script_blueprint" jsonb`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scripts" DROP COLUMN "script_blueprint"`);
  }
}
