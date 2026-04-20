import { describe, expect, it, beforeEach } from 'vitest';
import { sqlite } from '@/lib/db/client';
import { ensureSchema } from '@/lib/db/init';
import {
  appendNote,
  createContact,
  getContact,
  listContacts,
  updateContact,
} from '@/lib/services/contacts';

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

describe('contacts service', () => {
  it('creates a contact with kids, handles, and a first note', () => {
    const id = createContact({
      displayName: 'Jenny Wang',
      nicknames: ['Jen'],
      kids: [
        { name: 'Lucas', grade: '2', school: 'Pinewood', sports: ['Soccer'], interests: null },
      ],
      handles: [{ platform: 'wechat', handle: 'jenny_w88' }],
      tagIds: [],
      firstNote: 'Met at Pinewood spring party.',
    });

    const detail = getContact(id);
    expect(detail).not.toBeNull();
    const d = detail!;
    expect(d.contact.displayName).toBe('Jenny Wang');
    expect(d.kids).toHaveLength(1);
    expect(d.kids[0]?.name).toBe('Lucas');
    expect(d.handles[0]?.platform).toBe('wechat');
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0]?.body).toMatch(/Pinewood/);
  });

  it('updates kids by replacing them', () => {
    const id = createContact({
      displayName: 'Peter Wang',
      nicknames: [],
      kids: [{ name: 'A', sports: [] }],
      handles: [],
      tagIds: [],
    });
    updateContact(id, {
      displayName: 'Peter Wang',
      kids: [{ name: 'Beth', sports: [] }],
    });
    const d = getContact(id);
    expect(d!.kids.map((k) => k.name)).toEqual(['Beth']);
  });

  it('appends notes in reverse-chronological order', async () => {
    const id = createContact({
      displayName: 'X',
      nicknames: [],
      kids: [],
      handles: [],
      tagIds: [],
    });
    appendNote(id, 'one', 'typed');
    await new Promise((r) => setTimeout(r, 2));
    appendNote(id, 'two', 'voice');
    const d = getContact(id);
    expect(d!.notes.map((n) => n.body)).toEqual(['two', 'one']);
    expect(d!.notes[0]?.source).toBe('voice');
  });

  it('list filters by search query across names and kids', () => {
    createContact({ displayName: 'Jenny Wang', nicknames: [], kids: [{ name: 'Lucas', sports: [] }], handles: [], tagIds: [] });
    createContact({ displayName: 'Peter Smith', nicknames: [], kids: [], handles: [], tagIds: [] });
    expect(listContacts({ q: 'lucas' }).map((c) => c.displayName)).toContain('Jenny Wang');
    expect(listContacts({ q: 'smith' }).map((c) => c.displayName)).toEqual(['Peter Smith']);
  });
});
