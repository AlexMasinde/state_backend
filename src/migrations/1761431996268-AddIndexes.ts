import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1761431996268 implements MigrationInterface {
    name = 'AddIndexes1761431996268'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_participants_name\` ON \`participants\``);
        await queryRunner.query(`ALTER TABLE \`participants\` ADD UNIQUE INDEX \`IDX_a46dcb720cdc9d855c3294c34f\` (\`idNumber\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_3aea230d5fdbdc53ce3bf9091e\` ON \`events\` (\`eventDate\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_03dcebc1ab44daa177ae9479c4\` ON \`events\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_38124c9fc23a0d0d0c0c53aafb\` ON \`events\` (\`createdBy\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_a7022312e5e867b7da354b1e28\` ON \`participants\` (\`name\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_ddde7e189e5646393363c957de\` ON \`participants\` (\`checkedIn\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_a622804301e735196918e6a47e\` ON \`participants\` (\`eventId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_671481c2dedcc3553292108efa\` ON \`participants\` (\`phoneNumber\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_671481c2dedcc3553292108efa\` ON \`participants\``);
        await queryRunner.query(`DROP INDEX \`IDX_a622804301e735196918e6a47e\` ON \`participants\``);
        await queryRunner.query(`DROP INDEX \`IDX_ddde7e189e5646393363c957de\` ON \`participants\``);
        await queryRunner.query(`DROP INDEX \`IDX_a7022312e5e867b7da354b1e28\` ON \`participants\``);
        await queryRunner.query(`DROP INDEX \`IDX_38124c9fc23a0d0d0c0c53aafb\` ON \`events\``);
        await queryRunner.query(`DROP INDEX \`IDX_03dcebc1ab44daa177ae9479c4\` ON \`events\``);
        await queryRunner.query(`DROP INDEX \`IDX_3aea230d5fdbdc53ce3bf9091e\` ON \`events\``);
        await queryRunner.query(`ALTER TABLE \`participants\` DROP INDEX \`IDX_a46dcb720cdc9d855c3294c34f\``);
        await queryRunner.query(`CREATE INDEX \`IDX_participants_name\` ON \`participants\` (\`name\`)`);
    }

}
