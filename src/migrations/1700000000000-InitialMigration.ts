import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1700000000000 implements MigrationInterface {
    name = 'InitialMigration1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create users table
        await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\` varchar(36) NOT NULL,
                \`email\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`passwordHash\` varchar(255) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create events table
        await queryRunner.query(`
            CREATE TABLE \`events\` (
                \`id\` varchar(36) NOT NULL,
                \`eventName\` varchar(255) NOT NULL,
                \`eventDate\` datetime NOT NULL,
                \`location\` varchar(255) NOT NULL,
                \`organizer\` varchar(255) NOT NULL,
                \`status\` varchar(50) NOT NULL DEFAULT 'open',
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`createdById\` varchar(36) NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create participants table
        await queryRunner.query(`
            CREATE TABLE \`participants\` (
                \`id\` varchar(36) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`idNumber\` varchar(255) NOT NULL,
                \`group\` varchar(255) NOT NULL,
                \`origin\` varchar(255) NOT NULL,
                \`phoneNumber\` varchar(255) NOT NULL,
                \`checkedIn\` tinyint NOT NULL DEFAULT 0,
                \`checkedInAt\` datetime NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`eventId\` varchar(36) NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create refresh_tokens table
        await queryRunner.query(`
            CREATE TABLE \`refresh_tokens\` (
                \`id\` varchar(36) NOT NULL,
                \`tokenHash\` varchar(255) NOT NULL,
                \`userId\` varchar(36) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE \`events\` 
            ADD CONSTRAINT \`FK_events_createdById\` 
            FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`participants\` 
            ADD CONSTRAINT \`FK_participants_eventId\` 
            FOREIGN KEY (\`eventId\`) REFERENCES \`events\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`refresh_tokens\` 
            ADD CONSTRAINT \`FK_refresh_tokens_userId\` 
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_refresh_tokens_userId\``);
        await queryRunner.query(`ALTER TABLE \`participants\` DROP FOREIGN KEY \`FK_participants_eventId\``);
        await queryRunner.query(`ALTER TABLE \`events\` DROP FOREIGN KEY \`FK_events_createdById\``);

        // Drop tables
        await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
        await queryRunner.query(`DROP TABLE \`participants\``);
        await queryRunner.query(`DROP TABLE \`events\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }
}
