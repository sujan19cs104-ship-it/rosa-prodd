import { db } from '../db';

async function migrate() {
  console.log('Running migration: add creator_name to expenses table');

  try {
    // Check if the column already exists
    const tableInfo = await db.all(`PRAGMA table_info(expenses)`);
    const columnExists = tableInfo.some((column: any) => column.name === 'creator_name');

    if (!columnExists) {
      // Add the creator_name column
      await db.run(`ALTER TABLE expenses ADD COLUMN creator_name TEXT`);
      console.log('Successfully added creator_name column to expenses table');
    } else {
      console.log('creator_name column already exists in expenses table');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrate()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });