import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateReferenceCategories1781005866479 implements MigrationInterface {
    name = 'UpdateReferenceCategories1781005866479'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."materials_category_enum" RENAME TO "materials_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."materials_category_enum" AS ENUM('product', 'scene', 'model', 'apparel_underwear', 'shoes_bags', 'food_beverage', 'beauty_skincare', 'sports_outdoors', 'daily_necessities', 'home_textiles', 'maternity_baby', 'health_care', '3c_digital', 'kitchen_appliances', 'furniture_building', 'jewelry_accessories', 'toys_instruments', 'books_education', 'gifts_culture', 'fresh_produce', 'flowers_plants', 'pet_supplies', 'auto_motorcycle', 'watches_accessories', 'local_life', 'second_hand', 'luxury', 'raw_materials_packaging', 'other')`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "category" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "category" TYPE "public"."materials_category_enum" USING "category"::"text"::"public"."materials_category_enum"`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "category" SET DEFAULT 'other'`);
        await queryRunner.query(`DROP TYPE "public"."materials_category_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."materials_category_enum_old" AS ENUM('product', 'scene', 'model', 'beauty', 'apparel', '3c', 'other')`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "category" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "category" TYPE "public"."materials_category_enum_old" USING "category"::"text"::"public"."materials_category_enum_old"`);
        await queryRunner.query(`ALTER TABLE "materials" ALTER COLUMN "category" SET DEFAULT 'other'`);
        await queryRunner.query(`DROP TYPE "public"."materials_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."materials_category_enum_old" RENAME TO "materials_category_enum"`);
    }

}
