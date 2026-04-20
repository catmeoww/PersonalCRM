import { describe, expect, it, beforeEach } from 'vitest';
import { sqlite } from '@/lib/db/client';
import { ensureSchema } from '@/lib/db/init';
import { createContact } from '@/lib/services/contacts';
import { copyHolidayYear, listHolidayRows, upsertHoliday } from '@/lib/services/holiday';

beforeEach(() => {
  ensureSchema();
  sqlite.exec(`
    DELETE FROM note_entries;
    DELETE FROM contact_tags;
    DELETE FROM holiday_cards;
    DELETE FROM search_index;
    DELETE FROM messaging_handles;
    DELETE FROM kids;
    DELETE FROM tags;
    DELETE FROM contacts;
  `);
});

describe('holiday service', () => {
  it('copies last-year recipients as pending for this year', () => {
    const a = createContact({ displayName: 'A', nicknames: [], kids: [], handles: [], tagIds: [] });
    const b = createContact({ displayName: 'B', nicknames: [], kids: [], handles: [], tagIds: [] });
    const c = createContact({ displayName: 'C', nicknames: [], kids: [], handles: [], tagIds: [] });
    upsertHoliday({ contactId: a, year: 2025, sent: true });
    upsertHoliday({ contactId: b, year: 2025, sent: true });
    upsertHoliday({ contactId: c, year: 2025, sent: false });

    const copied = copyHolidayYear(2025, 2026);
    expect(copied).toBe(2);

    const rows = listHolidayRows(2026);
    const map = new Map(rows.map((r) => [r.displayName, r]));
    expect(map.get('A')!.sentThisYear).toBe(false);
    expect(map.get('A')!.sentLastYear).toBe(true);
    expect(map.get('C')!.sentLastYear).toBe(false);
  });

  it('upsert toggles sent status idempotently', () => {
    const a = createContact({ displayName: 'A', nicknames: [], kids: [], handles: [], tagIds: [] });
    upsertHoliday({ contactId: a, year: 2026, sent: true, channel: 'physical' });
    upsertHoliday({ contactId: a, year: 2026, sent: false });
    const rows = listHolidayRows(2026);
    expect(rows[0]?.sentThisYear).toBe(false);
  });
});
