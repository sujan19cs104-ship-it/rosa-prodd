import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

// Use SQLite for local development
const sqlite = new Database('rosae.db');
export const db = drizzle(sqlite, { schema });

// Allow controlled raw execution for maintenance tasks
export function execRaw(sqlRaw: string) {
  return sqlite.exec(sqlRaw);
}

// Initialize database tables
export function initializeDatabase() {
  // SAFETY: do not drop tables in dev/prod; keep data. Only ensure schema.
  try {
    const info = sqlite.prepare(`PRAGMA table_info(expenses)`).all() as any[];
    const hasCreatorName = info.some((c) => c.name === 'creator_name');
    if (!hasCreatorName) {
      sqlite.exec(`ALTER TABLE expenses ADD COLUMN creator_name TEXT`);
    }
    if (!info.some((c) => c.name === 'paid_cash')) {
      sqlite.exec(`ALTER TABLE expenses ADD COLUMN paid_cash REAL`);
    }
    if (!info.some((c) => c.name === 'paid_upi')) {
      sqlite.exec(`ALTER TABLE expenses ADD COLUMN paid_upi REAL`);
    }
    if (!info.some((c) => c.name === 'paid_via')) {
      sqlite.exec(`ALTER TABLE expenses ADD COLUMN paid_via TEXT`);
    }
  } catch {}

  // Ensure users has active column
  try {
    const uInfo = sqlite.prepare(`PRAGMA table_info(users)`).all() as any[];
    if (!uInfo.some(c => c.name === 'active')) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
    }
  } catch {}

  // Ensure bookings has refund columns (for existing DBs)
  try {
    const bInfo = sqlite.prepare(`PRAGMA table_info(bookings)`).all() as any[];
    const addIfMissing = (col: string, ddl: string) => {
      if (!bInfo.some(c => c.name === col)) sqlite.exec(`ALTER TABLE bookings ADD COLUMN ${ddl}`);
    };
    addIfMissing('refund_status', 'refund_status TEXT DEFAULT \"none\"');
    addIfMissing('refund_amount', 'refund_amount REAL NOT NULL DEFAULT 0');
    addIfMissing('refund_reason', 'refund_reason TEXT');
    addIfMissing('refunded_at', 'refunded_at TEXT');
    addIfMissing('refund_requested_by', 'refund_requested_by TEXT');
    addIfMissing('refund_approved_by', 'refund_approved_by TEXT');
    // Ensure review flag exists for reviews feature
    addIfMissing('review_flag', 'review_flag INTEGER NOT NULL DEFAULT 0');
  } catch {}

  // Ensure feedbacks has denormalized customer columns (for existing DBs)
  try {
    const fInfo = sqlite.prepare(`PRAGMA table_info(feedbacks)`).all() as any[];
    if (!fInfo.some(c => c.name === 'customer_name')) sqlite.exec(`ALTER TABLE feedbacks ADD COLUMN customer_name TEXT`);
    if (!fInfo.some(c => c.name === 'phone_number')) sqlite.exec(`ALTER TABLE feedbacks ADD COLUMN phone_number TEXT`);
  } catch {}

  // Create tables with correct schema
  sqlite.exec(`
         CREATE TABLE IF NOT EXISTS users (
       id TEXT PRIMARY KEY,
       email TEXT UNIQUE NOT NULL,
       first_name TEXT,
       last_name TEXT,
       profile_image_url TEXT,
       password_hash TEXT,
       role TEXT DEFAULT 'user',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      theatre_name TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      guests INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      phone_number TEXT,
      age INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      cash_amount REAL NOT NULL DEFAULT 0,
      upi_amount REAL NOT NULL DEFAULT 0,
      snacks_amount REAL NOT NULL DEFAULT 0,
      snacks_cash REAL NOT NULL DEFAULT 0,
      snacks_upi REAL NOT NULL DEFAULT 0,
      booking_date TEXT NOT NULL,
      is_eighteen_plus INTEGER NOT NULL DEFAULT 1,
      eighteen_plus_reason TEXT,
      eighteen_plus_description TEXT,
      visited INTEGER NOT NULL DEFAULT 1,
      visited_reason TEXT,
      visited_description TEXT,
      repeat_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      -- Refund fields
      refund_status TEXT DEFAULT 'none',
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_reason TEXT,
      refunded_at TEXT,
      refund_requested_by TEXT,
      refund_approved_by TEXT,
      review_flag INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (refund_requested_by) REFERENCES users(id),
      FOREIGN KEY (refund_approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      creator_name TEXT,
      paid_cash REAL,
      paid_upi REAL,
      paid_via TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      leave_type TEXT NOT NULL DEFAULT 'PTO',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      partial_day TEXT,
      reason TEXT NOT NULL,
      keys_holder_id TEXT,
      keys_holder_name TEXT,
      coverage_by_id TEXT,
      coverage_by_name TEXT,
      attach_document_url TEXT,
      comp_off_used INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      override_one_day_rule INTEGER DEFAULT 0,
      override_reason TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (keys_holder_id) REFERENCES users(id),
      FOREIGN KEY (coverage_by_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      default_annual INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS leave_balances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      leave_type_code TEXT NOT NULL,
      year INTEGER NOT NULL,
      allocated REAL NOT NULL DEFAULT 0,
      used REAL NOT NULL DEFAULT 0,
      carried_over REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT DEFAULT 'leave',
      is_read INTEGER NOT NULL DEFAULT 0,
      related_type TEXT,
      related_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS customer_tickets (
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
    );

    -- Reviews table
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
    );

    -- Lead Infos table
    CREATE TABLE IF NOT EXISTS lead_infos (
      id TEXT PRIMARY KEY DEFAULT (
        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)),2) || '-' ||
        substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))
      ),
      date TEXT NOT NULL,
      shift TEXT NOT NULL,
      source TEXT NOT NULL,
      total_leads INTEGER NOT NULL DEFAULT 0,
      good_leads INTEGER NOT NULL DEFAULT 0,
      bad_leads INTEGER NOT NULL DEFAULT 0,
      calls_made INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Feedbacks table
    CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY DEFAULT (
        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)),2) || '-' ||
        substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))
      ),
      booking_id TEXT NOT NULL,
      booking_date TEXT,
      time_slot TEXT,
      theatre_name TEXT,
      customer_name TEXT,
      phone_number TEXT,
      collected INTEGER NOT NULL DEFAULT 1,
      reason TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Follow-ups table
    CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY DEFAULT (
        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)),2) || '-' ||
        substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))
      ),
      booking_id TEXT,
      customer_name TEXT,
      phone_number TEXT,
      reason TEXT,
      type TEXT DEFAULT 'feedback',
      status TEXT DEFAULT 'pending',
      due_at TEXT,
      completed_at TEXT,
      notified_overdue_at TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Refund requests table
    CREATE TABLE IF NOT EXISTS refund_requests (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT NOT NULL,
      approved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

         CREATE TABLE IF NOT EXISTS activity_logs (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       action TEXT NOT NULL,
       resource_type TEXT NOT NULL,
       resource_id TEXT,
       details TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id)
     );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire DATETIME NOT NULL
    );

    -- Login tracker table
    CREATE TABLE IF NOT EXISTS login_tracker (
      id TEXT PRIMARY KEY DEFAULT (
        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)),2) || '-' ||
        substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))
      ),
      user_id TEXT NOT NULL,
      email TEXT,
      login_time TEXT NOT NULL,
      logout_time TEXT,
      session_duration_sec INTEGER,
      device_type TEXT,
      user_agent TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      google_calendar_event_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS sales_reports (
      id TEXT PRIMARY KEY,
      report_date TEXT NOT NULL,
      total_revenue REAL NOT NULL,
      food_sales REAL DEFAULT 0,
      screen_sales REAL DEFAULT 0,
      total_bookings INTEGER DEFAULT 0,
      total_guests INTEGER DEFAULT 0,
      avg_booking_value REAL DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Revenue goals (monthly)
    CREATE TABLE IF NOT EXISTS revenue_goals (
      id TEXT PRIMARY KEY DEFAULT (
        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)),2) || '-' ||
        substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))
      ),
      month TEXT NOT NULL,
      goal_amount INTEGER NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS configurations (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ad_spends (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)),2) || '-' ||
         substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
      date TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'Meta Ads',
      campaign_name TEXT NOT NULL,
      ad_set_name TEXT,
      ad_name TEXT,
      ad_spend REAL NOT NULL DEFAULT 0,
      total_leads INTEGER NOT NULL DEFAULT 0,
      good_leads INTEGER NOT NULL DEFAULT 0,
      bad_leads INTEGER NOT NULL DEFAULT 0,
      sales_count INTEGER,
      revenue REAL,
      impressions INTEGER,
      clicks INTEGER,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

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
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS login_tracker (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT,
      login_time TEXT NOT NULL,
      logout_time TEXT,
      session_duration_sec INTEGER,
      device_type TEXT,
      user_agent TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Ensure daily_income has adjusted columns (for existing DBs)
  try {
    const dInfo = sqlite.prepare(`PRAGMA table_info(daily_income)`).all() as any[];
    const addIfMissing = (col: string, ddl: string) => {
      if (!dInfo.some(c => c.name === col)) sqlite.exec(`ALTER TABLE daily_income ADD COLUMN ${ddl}`);
    };
    addIfMissing('adjusted_shows', 'adjusted_shows INTEGER');
    addIfMissing('adjusted_revenue', 'adjusted_revenue REAL');
    addIfMissing('refund_total', 'refund_total REAL');
  } catch {}

  // Ensure customer_tickets has required columns (for existing DBs)
  try {
    const info = sqlite.prepare(`PRAGMA table_info(customer_tickets)`).all() as any[];
    const hasBookingId = info.some((c) => c.name === 'booking_id');
    const hasReason = info.some((c) => c.name === 'reason');
    const hasNotes = info.some((c) => c.name === 'notes');
    const hasDeletedAt = info.some((c) => c.name === 'deleted_at');
    const hasTimeSlot = info.some((c) => c.name === 'time_slot');
    if (!hasBookingId) sqlite.exec(`ALTER TABLE customer_tickets ADD COLUMN booking_id TEXT`);
    if (!hasReason) sqlite.exec(`ALTER TABLE customer_tickets ADD COLUMN reason TEXT`);
    if (!hasNotes) sqlite.exec(`ALTER TABLE customer_tickets ADD COLUMN notes TEXT`);
    if (!hasDeletedAt) sqlite.exec(`ALTER TABLE customer_tickets ADD COLUMN deleted_at DATETIME`);
    if (!hasTimeSlot) sqlite.exec(`ALTER TABLE customer_tickets ADD COLUMN time_slot TEXT`);
  } catch {}

  // Ensure leave_applications new columns exist (for existing DBs)
  try {
    const leaveInfo = sqlite.prepare(`PRAGMA table_info(leave_applications)`).all() as any[];
    const hasUserId = leaveInfo.some(c => c.name === 'user_id');
    const addIfMissing = (col: string, ddl: string) => {
      if (!leaveInfo.some(c => c.name === col)) sqlite.exec(`ALTER TABLE leave_applications ADD COLUMN ${ddl}`);
    };
    if (!hasUserId) {
      // If legacy column employee_name exists, keep it; add user_id nullable
      sqlite.exec(`ALTER TABLE leave_applications ADD COLUMN user_id TEXT`);
    }
    addIfMissing('partial_day', 'partial_day TEXT');
    addIfMissing('keys_holder_id', 'keys_holder_id TEXT');
    addIfMissing('keys_holder_name', 'keys_holder_name TEXT');
    addIfMissing('coverage_by_id', 'coverage_by_id TEXT');
    addIfMissing('coverage_by_name', 'coverage_by_name TEXT');
    addIfMissing('attach_document_url', 'attach_document_url TEXT');
    addIfMissing('comp_off_used', 'comp_off_used INTEGER DEFAULT 0');
    addIfMissing('override_one_day_rule', 'override_one_day_rule INTEGER DEFAULT 0');
    addIfMissing('override_reason', 'override_reason TEXT');
    addIfMissing('reviewed_by', 'reviewed_by TEXT');
    addIfMissing('reviewed_at', 'reviewed_at TEXT');
  } catch {}

  // Normalize leave_applications if legacy NOT NULL columns exist (e.g., employee_name)
  try {
    const info = sqlite.prepare(`PRAGMA table_info(leave_applications)`).all() as any[];
    const hasEmployeeName = info.some((c: any) => c.name === 'employee_name');
    const needsRebuild = hasEmployeeName;
    if (needsRebuild) {
      sqlite.exec('BEGIN');
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS leave_applications_new (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          leave_type TEXT NOT NULL DEFAULT 'PTO',
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          partial_day TEXT,
          reason TEXT NOT NULL,
          keys_holder_id TEXT,
          keys_holder_name TEXT,
          coverage_by_id TEXT,
          coverage_by_name TEXT,
          attach_document_url TEXT,
          comp_off_used INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          override_one_day_rule INTEGER DEFAULT 0,
          override_reason TEXT,
          reviewed_by TEXT,
          reviewed_at TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (keys_holder_id) REFERENCES users(id),
          FOREIGN KEY (coverage_by_id) REFERENCES users(id),
          FOREIGN KEY (reviewed_by) REFERENCES users(id)
        );
      `);
      const existing = new Set(info.map((c: any) => c.name));
      const colsToCopy = [
        'id',
        existing.has('user_id') ? 'user_id' : 'NULL AS user_id',
        existing.has('leave_type') ? 'leave_type' : "'PTO' AS leave_type",
        existing.has('start_date') ? 'start_date' : "'' AS start_date",
        existing.has('end_date') ? 'end_date' : "'' AS end_date",
        existing.has('partial_day') ? 'partial_day' : 'NULL AS partial_day',
        existing.has('reason') ? 'reason' : "'' AS reason",
        existing.has('keys_holder_id') ? 'keys_holder_id' : 'NULL AS keys_holder_id',
        existing.has('keys_holder_name') ? 'keys_holder_name' : 'NULL AS keys_holder_name',
        existing.has('coverage_by_id') ? 'coverage_by_id' : 'NULL AS coverage_by_id',
        existing.has('coverage_by_name') ? 'coverage_by_name' : 'NULL AS coverage_by_name',
        existing.has('attach_document_url') ? 'attach_document_url' : 'NULL AS attach_document_url',
        existing.has('comp_off_used') ? 'comp_off_used' : '0 AS comp_off_used',
        existing.has('status') ? 'status' : "'pending' AS status",
        existing.has('override_one_day_rule') ? 'override_one_day_rule' : '0 AS override_one_day_rule',
        existing.has('override_reason') ? 'override_reason' : 'NULL AS override_reason',
        existing.has('reviewed_by') ? 'reviewed_by' : 'NULL AS reviewed_by',
        existing.has('reviewed_at') ? 'reviewed_at' : 'NULL AS reviewed_at',
        existing.has('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP AS created_at',
      ];
      const selectCols = colsToCopy.join(', ');
      const insertCols = colsToCopy.map((c) => c.replace(/\sAS\s.*$/i, '')).join(', ');
      sqlite.exec(`INSERT INTO leave_applications_new (${insertCols}) SELECT ${selectCols} FROM leave_applications;`);
      sqlite.exec(`DROP TABLE leave_applications;`);
      sqlite.exec(`ALTER TABLE leave_applications_new RENAME TO leave_applications;`);
      sqlite.exec('COMMIT');
      console.log('Normalized leave_applications table (removed legacy columns).');
    }
  } catch (e) {
    try { sqlite.exec('ROLLBACK'); } catch {}
    console.log('Note: could not normalize leave_applications table:', e);
  }

  // Ensure leave_types table exists
  try {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS leave_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      default_annual INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )`);
  } catch {}

  // Ensure leave_balances table exists
  try {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS leave_balances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      leave_type_code TEXT NOT NULL,
      year INTEGER NOT NULL,
      allocated REAL NOT NULL DEFAULT 0,
      used REAL NOT NULL DEFAULT 0,
      carried_over REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  } catch {}

  // Ensure notifications table exists
  try {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT DEFAULT 'leave',
      is_read INTEGER NOT NULL DEFAULT 0,
      related_type TEXT,
      related_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  } catch {}

  // Normalize customer_tickets if legacy NOT NULL columns exist (auto-rebuild)
  try {
    const info = sqlite.prepare(`PRAGMA table_info(customer_tickets)`).all() as any[];
    const hasCustomerName = info.some((c: any) => c.name === 'customer_name');
    const hasIssue = info.some((c: any) => c.name === 'issue');
    const hasPriority = info.some((c: any) => c.name === 'priority');
    const needsRebuild = hasCustomerName || hasIssue || hasPriority;
    if (needsRebuild) {
      sqlite.exec('BEGIN');
      sqlite.exec(`
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
        );
      `);
      const existing = new Set(info.map((c: any) => c.name));
      const colsToCopy = [
        'id',
        existing.has('booking_id') ? 'booking_id' : "'' AS booking_id",
        existing.has('reason') ? 'reason' : "'' AS reason",
        existing.has('notes') ? 'notes' : 'NULL AS notes',
        existing.has('time_slot') ? 'time_slot' : 'NULL AS time_slot',
        existing.has('status') ? 'status' : "'open' AS status",
        existing.has('created_by') ? 'created_by' : 'NULL AS created_by',
        existing.has('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP AS created_at',
        existing.has('updated_at') ? 'updated_at' : 'CURRENT_TIMESTAMP AS updated_at',
        existing.has('deleted_at') ? 'deleted_at' : 'NULL AS deleted_at',
      ];
      const selectCols = colsToCopy.join(', ');
      const insertCols = colsToCopy.map((c) => c.replace(/\sAS\s.*$/i, '')).join(', ');
      sqlite.exec(`INSERT INTO customer_tickets_new (${insertCols}) SELECT ${selectCols} FROM customer_tickets;`);
      sqlite.exec(`DROP TABLE customer_tickets;`);
      sqlite.exec(`ALTER TABLE customer_tickets_new RENAME TO customer_tickets;`);
      sqlite.exec('COMMIT');
      console.log('Normalized customer_tickets table (dropped legacy columns).');
    }
  } catch (e) {
    try { sqlite.exec('ROLLBACK'); } catch {}
    console.log('Note: could not normalize customer_tickets table:', e);
  }

  // Insert sample data for daily income if table is empty
  try {
    const count = sqlite.prepare(`SELECT COUNT(*) as count FROM daily_income`).get() as any;
    if (count.count === 0) {
      sqlite.exec(`
        INSERT INTO daily_income (
          date, number_of_shows, cash_received, upi_received, other_payments, notes
        ) VALUES 
        ('2025-08-30', 3, 5000, 3000, 2000, 'Weekend shows'),
        ('2025-08-31', 2, 4000, 2500, 0, 'Weekday low')
      `);
      console.log("Sample daily income data inserted");
    }
  } catch (error) {
    console.log("Note: Could not insert sample daily income data:", error);
  }
}