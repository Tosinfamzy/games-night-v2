import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function resetDatabase() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password123',
    database: process.env.DB_NAME || 'games_night',
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();

    console.log('Dropping all tables...');

    // Get all table names
    const tables = await dataSource.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    // Disable foreign key checks
    await dataSource.query('SET session_replication_role = replica;');

    // Drop all tables
    for (const { tablename } of tables) {
      console.log(`Dropping table: ${tablename}`);
      await dataSource.query(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
    }

    // Re-enable foreign key checks
    await dataSource.query('SET session_replication_role = DEFAULT;');

    console.log('✅ All tables dropped successfully!');
    console.log('Run "npm run start:dev" to recreate tables from entities.');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
