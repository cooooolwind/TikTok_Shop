import { MigrationInterface, QueryRunner } from "typeorm";

export class InitTemplates1781006967054 implements MigrationInterface {
    name = 'InitTemplates1781006967054'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" character varying(64) NOT NULL DEFAULT 'default', "name" character varying(256) NOT NULL, "strategy" text NOT NULL, "factors" jsonb NOT NULL, "constraints" jsonb NOT NULL DEFAULT '[]', "applicable_categories" jsonb NOT NULL DEFAULT '[]', "derived_from" jsonb NOT NULL DEFAULT '[]', "prompt" text, "status" character varying(16) NOT NULL DEFAULT 'enabled', "is_builtin" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_515948649ce0bbbe391de702ae5" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "templates"`);
    }

}
