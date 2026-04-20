import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  nicknamesJson: text('nicknames_json').notNull().default('[]'),
  workCompany: text('work_company'),
  workTitle: text('work_title'),
  workTeam: text('work_team'),
  bio: text('bio'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const kids = sqliteTable('kids', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  grade: text('grade'),
  school: text('school'),
  sportsJson: text('sports_json').notNull().default('[]'),
  interests: text('interests'),
});

export const messagingHandles = sqliteTable(
  'messaging_handles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contactId: integer('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    handle: text('handle').notNull(),
    displayName: text('display_name'),
  },
  (t) => ({
    uq: unique('handles_unique').on(t.contactId, t.platform, t.handle),
  }),
);

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  category: text('category').notNull(),
  color: text('color'),
});

export const contactTags = sqliteTable(
  'contact_tags',
  {
    contactId: integer('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: unique('contact_tags_pk').on(t.contactId, t.tagId),
  }),
);

export const noteEntries = sqliteTable('note_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  source: text('source').notNull().default('typed'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const holidayCards = sqliteTable(
  'holiday_cards',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contactId: integer('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    sent: integer('sent', { mode: 'boolean' }).notNull().default(false),
    channel: text('channel'),
    notes: text('notes'),
  },
  (t) => ({
    uq: unique('holiday_year_unique').on(t.contactId, t.year),
  }),
);

export const searchIndex = sqliteTable('search_index', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  token: text('token').notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Kid = typeof kids.$inferSelect;
export type MessagingHandle = typeof messagingHandles.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type NoteEntry = typeof noteEntries.$inferSelect;
export type HolidayCard = typeof holidayCards.$inferSelect;

export const PLATFORMS = ['whatsapp', 'wechat', 'imessage', 'sms', 'email', 'other'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TAG_CATEGORIES = ['work', 'parents', 'social', 'family', 'custom'] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export const NOTE_SOURCES = ['typed', 'voice'] as const;
export type NoteSource = (typeof NOTE_SOURCES)[number];

export const HOLIDAY_CHANNELS = ['physical', 'ecard', 'digital'] as const;
export type HolidayChannel = (typeof HOLIDAY_CHANNELS)[number];
