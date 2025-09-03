import { db } from '../db';

async function migrate() {
  console.log('Running migration: add reviews table and review_flag to bookings');

  try {
    await db.execute('BEGIN TRANSACTION');

    // Create reviews table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        phone TEXT,
        name TEXT,
        token TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME,
        verified_at DATETIME,
        verification_method TEXT,
        gmaps_place_id TEXT,
        gmaps_review_id TEXT,
        note TEXT,
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
      )
    `);

    // Ensure columns exist on reviews
    const rInfo = await db.all(`PRAGMA table_info(reviews)`);
    const ensure = async (name: string, ddl: string) => {
      if (!rInfo.some((c: any) => c.name === name)) {
        await db.execute(`ALTER TABLE reviews ADD COLUMN ${ddl}`);
      }
    };
    await ensure('phone', 'phone TEXT');
    await ensure('name', 'name TEXT');
    await ensure('token', 'token TEXT NOT NULL');
    await ensure('status', "status TEXT DEFAULT 'pending'");
    await ensure('requested_at', 'requested_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    await ensure('submitted_at', 'submitted_at DATETIME');
    await ensure('verified_at', 'verified_at DATETIME');
    await ensure('verification_method', 'verification_method TEXT');
    await ensure('gmaps_place_id', 'gmaps_place_id TEXT');
    await ensure('gmaps_review_id', 'gmaps_review_id TEXT');
    await ensure('note', 'note TEXT');

    // Add review_flag to bookings if missing
    const bInfo = await db.all(`PRAGMA table_info(bookings)`);
    if (!bInfo.some((c: any) => c.name === 'review_flag')) {
      await db.execute(`ALTER TABLE bookings ADD COLUMN review_flag INTEGER NOT NULL DEFAULT 0`);
    }

    await db.execute('COMMIT');
    console.log('Migration add_reviews_and_review_flag completed');
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