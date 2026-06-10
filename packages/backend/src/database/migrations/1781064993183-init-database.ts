import { MigrationInterface, QueryRunner } from "typeorm";

export class InitDatabase1781064993183 implements MigrationInterface {
    name = 'InitDatabase1781064993183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" character varying(64) NOT NULL DEFAULT 'default', "name" character varying(256) NOT NULL, "strategy" text NOT NULL, "factors" jsonb NOT NULL, "constraints" jsonb NOT NULL DEFAULT '[]', "applicable_categories" jsonb NOT NULL DEFAULT '[]', "derived_from" jsonb NOT NULL DEFAULT '[]', "prompt" text, "status" character varying(16) NOT NULL DEFAULT 'enabled', "is_builtin" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_515948649ce0bbbe391de702ae5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scenes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "script_id" uuid NOT NULL, "order_num" integer NOT NULL, "description" text, "camera_motion" character varying(256), "duration" double precision NOT NULL DEFAULT '3', "dialogue" text, "bgm_style" character varying(128), "subtitle" text, "visual_prompt" text, "constraints" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_071fd0f410cbb449feebafd46ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."scripts_mode_enum" AS ENUM('template', 'imitation', 'free')`);
        await queryRunner.query(`CREATE TYPE "public"."scripts_status_enum" AS ENUM('generating', 'draft', 'failed', 'confirmed')`);
        await queryRunner.query(`CREATE TABLE "scripts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" character varying(64) NOT NULL, "product_info" jsonb NOT NULL, "template_id" character varying, "reference_id" character varying, "source_material_ids" jsonb NOT NULL DEFAULT '[]', "generation_task_id" character varying, "generation_error" text, "mode" "public"."scripts_mode_enum" NOT NULL, "narrative_framework" text, "visual_style" character varying(512), "script_blueprint" jsonb, "total_duration" double precision NOT NULL DEFAULT '15', "status" "public"."scripts_status_enum" NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_399d1c469ffd6bac4e061e5fd8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "my_videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" character varying(64) NOT NULL DEFAULT 'default', "product_name" character varying(256) NOT NULL, "template_id" character varying(128) NOT NULL, "template_name" character varying(256) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'saved', "product_info" jsonb NOT NULL, "result" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_008fd5bb1e45d6d96c516618ca9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "material_analysis" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "material_id" uuid NOT NULL, "hook" text, "style" character varying(128), "duration" integer, "selling_points" jsonb NOT NULL DEFAULT '[]', "storyboard" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_2b1ca65159d78198e9666b024f" UNIQUE ("material_id"), CONSTRAINT "PK_5291fb46107a8977167944a3792" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."materials_type_enum" AS ENUM('image', 'video')`);
        await queryRunner.query(`CREATE TYPE "public"."materials_category_enum" AS ENUM('product', 'scene', 'model', 'apparel_underwear', 'shoes_bags', 'food_beverage', 'beauty_skincare', 'sports_outdoors', 'daily_necessities', 'home_textiles', 'maternity_baby', 'health_care', '3c_digital', 'kitchen_appliances', 'furniture_building', 'jewelry_accessories', 'toys_instruments', 'books_education', 'gifts_culture', 'fresh_produce', 'flowers_plants', 'pet_supplies', 'auto_motorcycle', 'watches_accessories', 'local_life', 'second_hand', 'luxury', 'raw_materials_packaging', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."materials_status_enum" AS ENUM('uploaded', 'processing', 'ready', 'failed')`);
        await queryRunner.query(`CREATE TABLE "materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" character varying(64) NOT NULL, "type" "public"."materials_type_enum" NOT NULL, "url" character varying(1024) NOT NULL, "thumbnail_url" character varying(1024), "name" character varying(512) NOT NULL DEFAULT '', "filename" character varying(512) NOT NULL, "size" bigint NOT NULL, "mime_type" character varying(128), "category" "public"."materials_category_enum" NOT NULL DEFAULT 'other', "tags" jsonb NOT NULL DEFAULT '[]', "source_declaration" character varying(64) NOT NULL, "ai_tags" jsonb NOT NULL DEFAULT '[]', "ai_description" text, "ai_embedding" vector(2048), "source_platform" character varying(64), "status" "public"."materials_status_enum" NOT NULL DEFAULT 'uploaded', "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2fd1a93ecb222a28bef28663fa0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "video_slices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "material_id" uuid NOT NULL, "start_time" double precision NOT NULL, "end_time" double precision NOT NULL, "description" text, "thumbnail_url" character varying(1024), "tags" jsonb NOT NULL DEFAULT '[]', "embedding" vector(2048), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aedc144bc14f44066c0af30d713" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."generation_tasks_status_enum" AS ENUM('queued', 'processing', 'done', 'failed')`);
        await queryRunner.query(`CREATE TABLE "generation_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "script_id" uuid NOT NULL, "status" "public"."generation_tasks_status_enum" NOT NULL DEFAULT 'queued', "progress" jsonb, "result" jsonb, "error" jsonb, "retry_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7049a47999be5f4c483b8f943c1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "task_id" uuid NOT NULL, "merchant_id" character varying(64) NOT NULL, "script_id" character varying NOT NULL, "url" character varying(1024) NOT NULL, "thumbnail_url" character varying(1024), "duration" double precision, "resolution" character varying(32), "aspect_ratio" character varying(16), "file_size" bigint, "export_formats" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_db2f73185cba77f7b2b7cf10055" UNIQUE ("task_id"), CONSTRAINT "REL_db2f73185cba77f7b2b7cf1005" UNIQUE ("task_id"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "scenes" ADD CONSTRAINT "FK_2fe0a257ae42feb4d7c34552e9e" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_analysis" ADD CONSTRAINT "FK_2b1ca65159d78198e9666b024fb" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video_slices" ADD CONSTRAINT "FK_5ac8586ad58abb83e18a3e8cc61" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generation_tasks" ADD CONSTRAINT "FK_37ae37cbf668aa1fd50a1c6b231" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "videos" ADD CONSTRAINT "FK_db2f73185cba77f7b2b7cf10055" FOREIGN KEY ("task_id") REFERENCES "generation_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_db2f73185cba77f7b2b7cf10055"`);
        await queryRunner.query(`ALTER TABLE "generation_tasks" DROP CONSTRAINT "FK_37ae37cbf668aa1fd50a1c6b231"`);
        await queryRunner.query(`ALTER TABLE "video_slices" DROP CONSTRAINT "FK_5ac8586ad58abb83e18a3e8cc61"`);
        await queryRunner.query(`ALTER TABLE "material_analysis" DROP CONSTRAINT "FK_2b1ca65159d78198e9666b024fb"`);
        await queryRunner.query(`ALTER TABLE "scenes" DROP CONSTRAINT "FK_2fe0a257ae42feb4d7c34552e9e"`);
        await queryRunner.query(`DROP TABLE "videos"`);
        await queryRunner.query(`DROP TABLE "generation_tasks"`);
        await queryRunner.query(`DROP TYPE "public"."generation_tasks_status_enum"`);
        await queryRunner.query(`DROP TABLE "video_slices"`);
        await queryRunner.query(`DROP TABLE "materials"`);
        await queryRunner.query(`DROP TYPE "public"."materials_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."materials_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."materials_type_enum"`);
        await queryRunner.query(`DROP TABLE "material_analysis"`);
        await queryRunner.query(`DROP TABLE "my_videos"`);
        await queryRunner.query(`DROP TABLE "scripts"`);
        await queryRunner.query(`DROP TYPE "public"."scripts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."scripts_mode_enum"`);
        await queryRunner.query(`DROP TABLE "scenes"`);
        await queryRunner.query(`DROP TABLE "templates"`);
    }

}
