import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_URL ?? './data/personalcrm.sqlite';

declare global {
  // eslint-disable-next-line no-var
  var __personalcrm_db: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

const singleton = globalThis.__personalcrm_db ?? createDb();
if (process.env.NODE_ENV !== 'production') globalThis.__personalcrm_db = singleton;

export const sqlite = singleton.sqlite;
export const db = singleton.db;
export { schema };
