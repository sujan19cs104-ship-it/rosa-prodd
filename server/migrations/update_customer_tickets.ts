import { db } from '../db';

async function migrate() {
  console.log('Running migration: update customer_tickets schema');

  try {
    // Ensure table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customer_tickets (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'open',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY (booking_id) REFERENCES bookings(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Get table info
    const info = await db.all(`PRAGMA table_info(customer_tickets)`);
    const hasBookingId = info.some((c: any) => c.name === 'booking_id');
    const hasReason = info.some((c: any) => c.name === 'reason');
    const hasNotes = info.some((c: any) => c.name === 'notes');
    const hasDeletedAt = info.some((c: any) => c.name === 'deleted_at');
    const hasTimeSlot = info.some((c: any) => c.name === 'time_slot');

    // Add columns if missing
    if (!hasBookingId) {
      await db.run(`ALTER TABLE customer_tickets ADD COLUMN booking_id TEXT`);
    }
    if (!hasReason) {
      await db.run(`ALTER TABLE customer_tickets ADD COLUMN reason TEXT`);
    }
    if (!hasNotes) {
      await db.run(`ALTER TABLE customer_tickets ADD COLUMN notes TEXT`);
    }
    if (!hasDeletedAt) {
      await db.run(`ALTER TABLE customer_tickets ADD COLUMN deleted_at DATETIME`);
    }
    if (!hasTimeSlot) {
      await db.run(`ALTER TABLE customer_tickets ADD COLUMN time_slot TEXT`);
    }

    // Optional: remove deprecated columns if present
    const hasCustomerName = info.some((c: any) => c.name === 'customer_name');
    const hasIssue = info.some((c: any) => c.name === 'issue');
    const hasPriority = info.some((c: any) => c.name === 'priority');
    if (hasCustomerName || hasIssue || hasPriority) {
      // SQLite doesn't support DROP COLUMN reliably; recreate table
      console.log('Recreating customer_tickets to drop deprecated columns');
      await db.execute('BEGIN TRANSACTION');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS customer_tickets_new (
          id TEXT PRIMARY KEY,
          booking_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          notes TEXT,
          time_slot TEXT,
          status TEXT DEFAULT 'open',
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME,
          FOREIGN KEY (booking_id) REFERENCES bookings(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      // Copy what we can
      const columns = ['id', 'status', 'created_by', 'created_at', 'updated_at'];
      const existingCols = info.map((c: any) => c.name);
      const copyCols = [
        ...columns.filter(c => existingCols.includes(c)),
        existingCols.includes('booking_id') ? 'booking_id' : "'' as booking_id",
        existingCols.includes('reason') ? 'reason' : "'' as reason",
        existingCols.includes('notes') ? 'notes' : 'NULL as notes',
        existingCols.includes('time_slot') ? 'time_slot' : 'NULL as time_slot',
        existingCols.includes('deleted_at') ? 'deleted_at' : 'NULL as deleted_at',
      ].join(', ');
      await db.execute(`INSERT INTO customer_tickets_new (${copyCols.replace(/\sas\s.*/g, '')}) SELECT ${copyCols} FROM customer_tickets`);
      await db.execute(`DROP TABLE customer_tickets`);
      await db.execute(`ALTER TABLE customer_tickets_new RENAME TO customer_tickets`);
      await db.execute('COMMIT');
    }

    console.log('Migration update_customer_tickets completed');
  } catch (error) {
    console.error('Migration failed:', error);
    try { await db.execute('ROLLBACK'); } catch {}
    throw error;
  }
}

migrate().then(() => {
  console.log('Migration completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});