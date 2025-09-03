import Database from 'better-sqlite3';

// This script deletes all data from tables except 'users' and 'configurations'
// Usage: tsx server/clear-data.ts

const db = new Database('rosae.db');

function run(sql: string) {
  try {
    db.exec(sql);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Disable foreign keys to avoid constraints during purge
run('PRAGMA foreign_keys = OFF;');

const tables = [
  'reviews',
  'refund_requests',
  'customer_tickets',
  'feedbacks',
  'follow_ups',
  'calendar_events',
  'sales_reports',
  'daily_income',
  'expenses',
  'ad_spends',
  'lead_infos',
  'revenue_goals',
  'notifications',
  'login_tracker',
  'leave_balances',
  'leave_applications',
  'leave_types',
  'activity_logs',
  'bookings',
  'sessions',
];

const results: Record<string, string> = {};

for (const t of tables) {
  const r = run(`DELETE FROM ${t};`);
  results[t] = r.ok ? 'ok' : r.error;
}

run('PRAGMA foreign_keys = ON;');

console.log(JSON.stringify({ ok: true, results }, null, 2));