import { describe, expect, it, beforeEach } from 'vitest';
import { sqlite } from '@/lib/db/client';
import { ensureSchema } from '@/lib/db/init';
import { createContact } from '@/lib/services/contacts';
import { __resetCacheForTests, matchTranscript } from '@/lib/services/voice-match';

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
  __resetCacheForTests();
});

describe('voice-match', () => {
  it('matches a contact by kid name', () => {
    createContact({
      displayName: 'Jenny Wang',
      nicknames: [],
      kids: [{ name: 'Lucas', sports: [] }],
      handles: [],
      tagIds: [],
    });
    createContact({
      displayName: 'Peter Smith',
      nicknames: [],
      kids: [{ name: 'Ethan', sports: [] }],
      handles: [],
      tagIds: [],
    });
    const cands = matchTranscript('Lucas is going to camp Galileo');
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0]?.displayName).toBe('Jenny Wang');
  });

  it('matches a contact by last name', () => {
    createContact({
      displayName: 'Peter Wang',
      nicknames: [],
      kids: [],
      handles: [],
      tagIds: [],
    });
    const cands = matchTranscript('Peter Wong is starting a new job');
    expect(cands.some((c) => c.displayName === 'Peter Wang')).toBe(true);
  });

  it('returns empty for gibberish', () => {
    createContact({
      displayName: 'Jenny Wang',
      nicknames: [],
      kids: [{ name: 'Lucas', sports: [] }],
      handles: [],
      tagIds: [],
    });
    const cands = matchTranscript('xyzzy plugh frobnicate');
    expect(cands).toEqual([]);
  });

  it('nickname match beats partial handle match', () => {
    createContact({
      displayName: 'Jennifer Huang',
      nicknames: ['Jen'],
      kids: [],
      handles: [],
      tagIds: [],
    });
    createContact({
      displayName: 'Alex Lee',
      nicknames: [],
      kids: [],
      handles: [{ platform: 'wechat', handle: 'jennyyy' }],
      tagIds: [],
    });
    const cands = matchTranscript('Jen told me about the field trip');
    expect(cands[0]?.displayName).toBe('Jennifer Huang');
  });
});
