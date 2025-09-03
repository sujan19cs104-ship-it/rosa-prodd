const Database = require('better-sqlite3');
const db = new Database('rosae.db');

try {
  const info = db.prepare(`PRAGMA table_info(bookings)`).all();
  const has = info.some(c => c.name === 'review_flag');
  if (!has) {
    db.exec(`ALTER TABLE bookings ADD COLUMN review_flag INTEGER NOT NULL DEFAULT 0`);
    console.log('Added review_flag to bookings');
  } else {
    console.log('review_flag already exists');
  }
  const after = db.prepare(`PRAGMA table_info(bookings)`).all();
  console.log('bookings columns:', after.map(c => c.name));
} catch (e) {
  console.error('Failed to update bookings schema:', e);
  process.exit(1);
}