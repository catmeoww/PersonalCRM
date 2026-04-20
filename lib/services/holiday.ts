import 'server-only';
import { sqlite } from '@/lib/db/client';
import '@/lib/db/init';

export type HolidayRow = {
  contactId: number;
  displayName: string;
  tagNames: string[];
  sentThisYear: boolean;
  sentLastYear: boolean;
  channel: string | null;
  notes: string | null;
};

export function listHolidayRows(year: number, tagIds: number[] = []): HolidayRow[] {
  const lastYear = year - 1;
  let contactRows: Array<{ id: number; display_name: string }>;

  if (tagIds.length > 0) {
    const placeholders = tagIds.map(() => '?').join(',');
    contactRows = sqlite
      .prepare(
        `SELECT c.id, c.display_name FROM contacts c
         JOIN contact_tags ct ON ct.contact_id = c.id
         WHERE ct.tag_id IN (${placeholders})
         GROUP BY c.id
         HAVING COUNT(DISTINCT ct.tag_id) = ?
         ORDER BY c.display_name`,
      )
      .all(...tagIds, tagIds.length) as typeof contactRows;
  } else {
    contactRows = sqlite
      .prepare(`SELECT id, display_name FROM contacts ORDER BY display_name`)
      .all() as typeof contactRows;
  }

  if (contactRows.length === 0) return [];
  const ids = contactRows.map((r) => r.id);
  const idPlaceholders = ids.map(() => '?').join(',');

  const holidayRows = sqlite
    .prepare(
      `SELECT contact_id, year, sent, channel, notes FROM holiday_cards
       WHERE contact_id IN (${idPlaceholders}) AND year IN (?, ?)`,
    )
    .all(...ids, year, lastYear) as Array<{
    contact_id: number;
    year: number;
    sent: number;
    channel: string | null;
    notes: string | null;
  }>;
  const byContact = new Map<number, { this?: typeof holidayRows[number]; last?: typeof holidayRows[number] }>();
  for (const r of holidayRows) {
    const e = byContact.get(r.contact_id) ?? {};
    if (r.year === year) e.this = r;
    if (r.year === lastYear) e.last = r;
    byContact.set(r.contact_id, e);
  }

  const tagRows = sqlite
    .prepare(
      `SELECT ct.contact_id, t.name FROM contact_tags ct
       JOIN tags t ON t.id = ct.tag_id
       WHERE ct.contact_id IN (${idPlaceholders})`,
    )
    .all(...ids) as Array<{ contact_id: number; name: string }>;
  const tagMap = new Map<number, string[]>();
  for (const r of tagRows) {
    const a = tagMap.get(r.contact_id) ?? [];
    a.push(r.name);
    tagMap.set(r.contact_id, a);
  }

  return contactRows.map((c) => {
    const e = byContact.get(c.id) ?? {};
    return {
      contactId: c.id,
      displayName: c.display_name,
      tagNames: tagMap.get(c.id) ?? [],
      sentThisYear: !!e.this?.sent,
      sentLastYear: !!e.last?.sent,
      channel: e.this?.channel ?? null,
      notes: e.this?.notes ?? null,
    };
  });
}

export function upsertHoliday(input: {
  contactId: number;
  year: number;
  sent: boolean;
  channel?: string | null;
  notes?: string | null;
}): void {
  sqlite
    .prepare(
      `INSERT INTO holiday_cards (contact_id, year, sent, channel, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(contact_id, year) DO UPDATE SET
         sent = excluded.sent,
         channel = excluded.channel,
         notes = excluded.notes`,
    )
    .run(input.contactId, input.year, input.sent ? 1 : 0, input.channel ?? null, input.notes ?? null);
}

export function copyHolidayYear(fromYear: number, toYear: number): number {
  const res = sqlite
    .prepare(
      `INSERT OR IGNORE INTO holiday_cards (contact_id, year, sent, channel)
       SELECT contact_id, ?, 0, channel FROM holiday_cards WHERE year = ? AND sent = 1`,
    )
    .run(toYear, fromYear);
  return res.changes;
}
