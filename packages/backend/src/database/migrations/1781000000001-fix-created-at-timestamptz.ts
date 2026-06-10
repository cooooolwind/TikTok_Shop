import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCreatedAtTimestamptz1781000000001 implements MigrationInterface {
  name = 'FixCreatedAtTimestamptz1781000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scripts" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ, ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "scenes" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ, ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_tasks" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "materials" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ, ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_analyses" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ, ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_slices" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ, ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "my_videos" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scripts" ALTER COLUMN "created_at" TYPE TIMESTAMP, ALTER COLUMN "updated_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "scenes" ALTER COLUMN "created_at" TYPE TIMESTAMP, ALTER COLUMN "updated_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_tasks" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "materials" ALTER COLUMN "created_at" TYPE TIMESTAMP, ALTER COLUMN "updated_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_analyses" ALTER COLUMN "created_at" TYPE TIMESTAMP, ALTER COLUMN "updated_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_slices" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" ALTER COLUMN "created_at" TYPE TIMESTAMP, ALTER COLUMN "updated_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "my_videos" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
  }
}
