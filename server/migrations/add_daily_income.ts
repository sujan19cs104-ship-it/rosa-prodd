import { db } from "../db";

export async function addDailyIncomeTable() {
  try {
    console.log("Creating daily_income table...");
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS daily_income (
        id TEXT PRIMARY KEY DEFAULT (
          hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
          substr(hex(randomblob(2)),2) || '-' ||
          substr('89ab',abs(random()) % 4 + 1, 1) ||
          substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))
        ),
        date TEXT NOT NULL,
        number_of_shows INTEGER NOT NULL,
        cash_received REAL NOT NULL DEFAULT 0,
        upi_received REAL NOT NULL DEFAULT 0,
        other_payments REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    
    console.log("daily_income table created successfully");
    
    // Insert sample data for testing
    console.log("Inserting sample data...");
    
    await db.execute(`
      INSERT OR IGNORE INTO daily_income (
        date, number_of_shows, cash_received, upi_received, other_payments, notes
      ) VALUES 
      ('2025-08-30', 3, 5000, 3000, 2000, 'Weekend shows'),
      ('2025-08-31', 2, 4000, 2500, 0, 'Weekday low')
    `);
    
    console.log("Sample data inserted successfully");
    
  } catch (error) {
    console.error("Error creating daily_income table:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addDailyIncomeTable()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}