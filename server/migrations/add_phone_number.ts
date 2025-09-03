import { db } from '../db';

async function migrate() {
  console.log('Running migration: add phone_number to bookings table');
  
  try {
    // Check if the column already exists
    const tableInfo = await db.all(`PRAGMA table_info(bookings)`);
    const columnExists = tableInfo.some((column: any) => column.name === 'phone_number');
    
    if (!columnExists) {
      // Add the phone_number column
      await db.run(`ALTER TABLE bookings ADD COLUMN phone_number TEXT`);
      console.log('Successfully added phone_number column to bookings table');
    } else {
      console.log('phone_number column already exists in bookings table');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrate().then(() => {
  console.log('Migration completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});