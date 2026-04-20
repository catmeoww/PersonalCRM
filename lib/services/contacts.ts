import 'server-only';
import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db, sqlite } from '@/lib/db/client';
import '@/lib/db/init';
import {
  contactTags,
  contacts,
  holidayCards,
  kids,
  messagingHandles,
  noteEntries,
  searchIndex,
  tags,
} from '@/lib/db/schema';
import type { ContactCreateInput, ContactUpdateInput } from '@/lib/validation/contacts';
import { buildSearchTokens, rebuildSearchIndexFor } from './search-index';

type ListOptions = {
  q?: string;
  tagIds?: number[];
  limit?: number;
  offset?: number;
};

export type ContactListItem = {
  id: number;
  displayName: string;
  workCompany: string | null;
  kidCount: number;
  tagIds: number[];
  tagNames: string[];
};

export function listContacts(opts: ListOptions = {}): ContactListItem[] {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const q = opts.q?.trim().toLowerCase();
  const tagIds = opts.tagIds?.filter((n) => Number.isFinite(n)) ?? [];

  let rows: Array<{
    id: number;
    display_name: string;
    work_company: string | null;
  }>;

  if (q) {
    const likeQ = `%${q}%`;
    rows = sqlite
      .prepare(
        `SELECT DISTINCT c.id, c.display_name, c.work_company
         FROM contacts c
         LEFT JOIN search_index si ON si.contact_id = c.id
         WHERE lower(c.display_name) LIKE ? OR si.token LIKE ?
         ORDER BY c.updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(likeQ, likeQ, limit, offset) as typeof rows;
  } else {
    rows = sqlite
      .prepare(
        `SELECT id, display_name, work_company
         FROM contacts
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as typeof rows;
  }

  if (tagIds.length > 0) {
    const placeholders = tagIds.map(() => '?').join(',');
    const allowed = sqlite
      .prepare(
        `SELECT contact_id FROM contact_tags
         WHERE tag_id IN (${placeholders})
         GROUP BY contact_id
         HAVING COUNT(DISTINCT tag_id) = ?`,
      )
      .all(...tagIds, tagIds.length) as Array<{ contact_id: number }>;
    const allowedSet = new Set(allowed.map((r) => r.contact_id));
    rows = rows.filter((r) => allowedSet.has(r.id));
  }

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const idPlaceholders = ids.map(() => '?').join(',');

  const kidCounts = sqlite
    .prepare(`SELECT contact_id, COUNT(*) as n FROM kids WHERE contact_id IN (${idPlaceholders}) GROUP BY contact_id`)
    .all(...ids) as Array<{ contact_id: number; n: number }>;
  const kidMap = new Map(kidCounts.map((k) => [k.contact_id, k.n]));

  const tagRows = sqlite
    .prepare(
      `SELECT ct.contact_id, t.id as tag_id, t.name
       FROM contact_tags ct JOIN tags t ON t.id = ct.tag_id
       WHERE ct.contact_id IN (${idPlaceholders})`,
    )
    .all(...ids) as Array<{ contact_id: number; tag_id: number; name: string }>;
  const tagMap = new Map<number, { ids: number[]; names: string[] }>();
  for (const r of tagRows) {
    const e = tagMap.get(r.contact_id) ?? { ids: [], names: [] };
    e.ids.push(r.tag_id);
    e.names.push(r.name);
    tagMap.set(r.contact_id, e);
  }

  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    workCompany: r.work_company,
    kidCount: kidMap.get(r.id) ?? 0,
    tagIds: tagMap.get(r.id)?.ids ?? [],
    tagNames: tagMap.get(r.id)?.names ?? [],
  }));
}

export type ContactDetail = {
  contact: {
    id: number;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    nicknames: string[];
    workCompany: string | null;
    workTitle: string | null;
    workTeam: string | null;
    bio: string | null;
    createdAt: number;
    updatedAt: number;
  };
  kids: Array<{
    id: number;
    name: string;
    grade: string | null;
    school: string | null;
    sports: string[];
    interests: string | null;
  }>;
  handles: Array<{ id: number; platform: string; handle: string; displayName: string | null }>;
  tags: Array<{ id: number; name: string; category: string }>;
  notes: Array<{ id: number; body: string; source: string; createdAt: number }>;
};

export function getContact(id: number): ContactDetail | null {
  const c = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!c) return null;

  const kidRows = db.select().from(kids).where(eq(kids.contactId, id)).all();
  const handleRows = db.select().from(messagingHandles).where(eq(messagingHandles.contactId, id)).all();
  const tagRows = sqlite
    .prepare(
      `SELECT t.id, t.name, t.category FROM tags t
       JOIN contact_tags ct ON ct.tag_id = t.id
       WHERE ct.contact_id = ?
       ORDER BY t.name`,
    )
    .all(id) as Array<{ id: number; name: string; category: string }>;
  const noteRows = db
    .select()
    .from(noteEntries)
    .where(eq(noteEntries.contactId, id))
    .orderBy(desc(noteEntries.createdAt))
    .limit(100)
    .all();

  return {
    contact: {
      id: c.id,
      displayName: c.displayName,
      firstName: c.firstName,
      lastName: c.lastName,
      nicknames: safeJsonArray(c.nicknamesJson),
      workCompany: c.workCompany,
      workTitle: c.workTitle,
      workTeam: c.workTeam,
      bio: c.bio,
      createdAt: c.createdAt.getTime?.() ?? (c.createdAt as unknown as number),
      updatedAt: c.updatedAt.getTime?.() ?? (c.updatedAt as unknown as number),
    },
    kids: kidRows.map((k) => ({
      id: k.id,
      name: k.name,
      grade: k.grade,
      school: k.school,
      sports: safeJsonArray(k.sportsJson),
      interests: k.interests,
    })),
    handles: handleRows.map((h) => ({
      id: h.id,
      platform: h.platform,
      handle: h.handle,
      displayName: h.displayName,
    })),
    tags: tagRows,
    notes: noteRows.map((n) => ({
      id: n.id,
      body: n.body,
      source: n.source,
      createdAt: n.createdAt.getTime?.() ?? (n.createdAt as unknown as number),
    })),
  };
}

export function createContact(input: ContactCreateInput): number {
  const tx = sqlite.transaction((): number => {
    const now = Date.now();
    const ins = sqlite
      .prepare(
        `INSERT INTO contacts (display_name, first_name, last_name, nicknames_json,
          work_company, work_title, work_team, bio, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.displayName,
        input.firstName ?? null,
        input.lastName ?? null,
        JSON.stringify(input.nicknames ?? []),
        input.workCompany ?? null,
        input.workTitle ?? null,
        input.workTeam ?? null,
        input.bio ?? null,
        now,
        now,
      );
    const id = Number(ins.lastInsertRowid);

    const insertKid = sqlite.prepare(
      `INSERT INTO kids (contact_id, name, grade, school, sports_json, interests)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const k of input.kids)
      insertKid.run(
        id,
        k.name,
        k.grade ?? null,
        k.school ?? null,
        JSON.stringify(k.sports ?? []),
        k.interests ?? null,
      );

    const insertHandle = sqlite.prepare(
      `INSERT OR IGNORE INTO messaging_handles (contact_id, platform, handle, display_name)
       VALUES (?, ?, ?, ?)`,
    );
    for (const h of input.handles) insertHandle.run(id, h.platform, h.handle, h.displayName ?? null);

    const insertTag = sqlite.prepare(
      `INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)`,
    );
    for (const tid of input.tagIds) insertTag.run(id, tid);

    if (input.firstNote && input.firstNote.trim()) {
      sqlite
        .prepare(`INSERT INTO note_entries (contact_id, body, source) VALUES (?, ?, 'typed')`)
        .run(id, input.firstNote.trim());
    }

    const tokens = buildSearchTokens({
      contactId: id,
      displayName: input.displayName,
      nicknames: input.nicknames ?? [],
      kids: input.kids,
      handles: input.handles,
    });
    rebuildSearchIndexFor(id, tokens);
    return id;
  });
  return tx();
}

export function updateContact(id: number, input: ContactUpdateInput): void {
  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) throw new Error('NOT_FOUND');

  const tx = sqlite.transaction(() => {
    const now = Date.now();
    sqlite
      .prepare(
        `UPDATE contacts SET
           display_name = COALESCE(?, display_name),
           first_name = ?, last_name = ?, nicknames_json = COALESCE(?, nicknames_json),
           work_company = ?, work_title = ?, work_team = ?, bio = ?,
           updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.displayName ?? null,
        input.firstName ?? null,
        input.lastName ?? null,
        input.nicknames ? JSON.stringify(input.nicknames) : null,
        input.workCompany ?? null,
        input.workTitle ?? null,
        input.workTeam ?? null,
        input.bio ?? null,
        now,
        id,
      );

    if (input.kids !== undefined) {
      sqlite.prepare(`DELETE FROM kids WHERE contact_id = ?`).run(id);
      const ins = sqlite.prepare(
        `INSERT INTO kids (contact_id, name, grade, school, sports_json, interests) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const k of input.kids)
        ins.run(id, k.name, k.grade ?? null, k.school ?? null, JSON.stringify(k.sports ?? []), k.interests ?? null);
    }

    if (input.handles !== undefined) {
      sqlite.prepare(`DELETE FROM messaging_handles WHERE contact_id = ?`).run(id);
      const ins = sqlite.prepare(
        `INSERT OR IGNORE INTO messaging_handles (contact_id, platform, handle, display_name) VALUES (?, ?, ?, ?)`,
      );
      for (const h of input.handles) ins.run(id, h.platform, h.handle, h.displayName ?? null);
    }

    if (input.tagIds !== undefined) {
      sqlite.prepare(`DELETE FROM contact_tags WHERE contact_id = ?`).run(id);
      const ins = sqlite.prepare(`INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)`);
      for (const tid of input.tagIds) ins.run(id, tid);
    }

    const fresh = getContact(id);
    if (fresh) {
      const tokens = buildSearchTokens({
        contactId: id,
        displayName: fresh.contact.displayName,
        nicknames: fresh.contact.nicknames,
        kids: fresh.kids,
        handles: fresh.handles,
      });
      rebuildSearchIndexFor(id, tokens);
    }
  });
  tx();
}

export function deleteContact(id: number): void {
  sqlite.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
}

export function appendNote(contactId: number, body: string, source: 'typed' | 'voice'): { id: number; createdAt: number } {
  const now = Date.now();
  const ins = sqlite
    .prepare(`INSERT INTO note_entries (contact_id, body, source, created_at) VALUES (?, ?, ?, ?)`)
    .run(contactId, body, source, now);
  sqlite.prepare(`UPDATE contacts SET updated_at = ? WHERE id = ?`).run(now, contactId);
  return { id: Number(ins.lastInsertRowid), createdAt: now };
}

function safeJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
