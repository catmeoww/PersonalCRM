import 'server-only';
import { sqlite } from './client';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  nicknames_json TEXT NOT NULL DEFAULT '[]',
  work_company TEXT,
  work_title TEXT,
  work_team TEXT,
  bio TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS kids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,
  school TEXT,
  sports_json TEXT NOT NULL DEFAULT '[]',
  interests TEXT
);

CREATE TABLE IF NOT EXISTS messaging_handles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  UNIQUE (contact_id, platform, handle)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  color TEXT
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS note_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'typed',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS holiday_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  channel TEXT,
  notes TEXT,
  UNIQUE (contact_id, year)
);

CREATE TABLE IF NOT EXISTS search_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_label TEXT,
  column_map_json TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  completed_at INTEGER,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_created INTEGER NOT NULL DEFAULT 0,
  rows_merged INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_run_id INTEGER NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  row_hash TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  parsed_json TEXT,
  matched_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  decision TEXT
);

CREATE INDEX IF NOT EXISTS idx_kids_contact ON kids(contact_id);
CREATE INDEX IF NOT EXISTS idx_handles_contact ON messaging_handles(contact_id);
CREATE INDEX IF NOT EXISTS idx_notes_contact_created ON note_entries(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_holiday_year ON holiday_cards(year);
CREATE INDEX IF NOT EXISTS idx_search_token ON search_index(token);
CREATE INDEX IF NOT EXISTS idx_search_contact ON search_index(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_run ON import_rows(import_run_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_hash ON import_rows(row_hash);
`;

let initialized = false;

export function ensureSchema() {
  if (initialized) return;
  sqlite.exec(SCHEMA_SQL);
  initialized = true;
}

ensureSchema();
