import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.MEDREM_DATA || join(here, 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'medrem.db'));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  gender TEXT,
  birthdate TEXT,
  age INTEGER,
  address TEXT,
  profile_picture TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  times TEXT NOT NULL DEFAULT '["08:00"]',
  days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  instructions TEXT,
  start_date TEXT,
  remind_before INTEGER NOT NULL DEFAULT 0,
  refill_total INTEGER,
  refill_remaining INTEGER,
  low_threshold INTEGER DEFAULT 5,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dose_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  med_id INTEGER NOT NULL,
  dose_date TEXT NOT NULL,
  dose_time TEXT NOT NULL,
  status TEXT NOT NULL,
  logged_at TEXT DEFAULT (datetime('now')),
  UNIQUE (med_id, dose_date, dose_time),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (med_id) REFERENCES medications(id)
);

CREATE TABLE IF NOT EXISTS checkups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  doctor TEXT NOT NULL,
  specialty TEXT,
  datetime TEXT NOT NULL,
  remind_before INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

db.exec('PRAGMA journal_mode = WAL');
db.exec(SCHEMA);

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
ensureColumn('medications', 'remind_before', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('checkups', 'remind_before', 'INTEGER NOT NULL DEFAULT 60');

export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
