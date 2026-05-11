import { describe, expect, it, beforeEach } from 'vitest';
import { sqlite } from '@/lib/db/client';
import { ensureSchema } from '@/lib/db/init';
import {
  applyMapping,
  classifyRow,
  commitCreate,
  commitMerge,
  guessHeaderMapping,
  parseCsv,
  sheetUrlToCsvUrl,
} from '@/lib/services/imports';
import { createContact, getContact } from '@/lib/services/contacts';
import { heuristicExtract } from '@/lib/services/llm';

beforeEach(() => {
  ensureSchema();
  sqlite.exec(`
    DELETE FROM import_rows;
    DELETE FROM import_runs;
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

describe('parseCsv', () => {
  it('parses quoted fields with commas and escaped quotes', () => {
    const csv = `Name,Notes\n"Wang, Jenny","says ""hi"""\nPeter,plain`;
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ['Name', 'Notes'],
      ['Wang, Jenny', 'says "hi"'],
      ['Peter', 'plain'],
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseCsv('a,b\n\n\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('sheetUrlToCsvUrl', () => {
  it('extracts sheet id and gid', () => {
    expect(
      sheetUrlToCsvUrl('https://docs.google.com/spreadsheets/d/ABC123_-/edit#gid=42'),
    ).toBe('https://docs.google.com/spreadsheets/d/ABC123_-/export?format=csv&gid=42');
  });
  it('defaults gid to 0 when missing', () => {
    expect(sheetUrlToCsvUrl('https://docs.google.com/spreadsheets/d/ABC/edit')).toBe(
      'https://docs.google.com/spreadsheets/d/ABC/export?format=csv&gid=0',
    );
  });
  it('returns null for non-sheet URLs', () => {
    expect(sheetUrlToCsvUrl('https://example.com')).toBeNull();
  });
});

describe('guessHeaderMapping', () => {
  it('maps common headers including the user example', () => {
    const mapping = guessHeaderMapping(['Name', 'org', 'What', 'email', 'notes']);
    expect(mapping).toEqual(['displayName', 'workCompany', 'bio', 'email', 'notes']);
  });
  it('leaves unknown headers as skip', () => {
    expect(guessHeaderMapping(['xyzzy', 'frob'])).toEqual(['skip', 'skip']);
  });
});

describe('applyMapping → classifyRow → commit', () => {
  it('creates a new contact when no matches exist', () => {
    const headers = ['Name', 'email', 'notes'];
    const mapping = guessHeaderMapping(headers);
    const mapped = applyMapping(['Jenny Wang', 'jenny@example.com', 'Met at school'], mapping, headers);
    const { matches, status } = classifyRow(mapped);
    expect(matches).toEqual([]);
    expect(status).toBe('create');
    const id = commitCreate(mapped, 'Imported');
    const detail = getContact(id);
    expect(detail!.contact.displayName).toBe('Jenny Wang');
    expect(detail!.handles.find((h) => h.platform === 'email')?.handle).toBe('jenny@example.com');
  });

  it('classifies as strong/auto-merge when email matches existing contact', () => {
    createContact({
      displayName: 'Jenny Wang',
      nicknames: [],
      kids: [],
      handles: [{ platform: 'email', handle: 'jenny@example.com' }],
      tagIds: [],
    });
    const headers = ['Name', 'email', 'notes'];
    const mapping = guessHeaderMapping(headers);
    const mapped = applyMapping(['Jenny W.', 'jenny@example.com', 'Update'], mapping, headers);
    const { matches, status } = classifyRow(mapped);
    expect(status).toBe('auto_merge');
    expect(matches[0]?.confidence).toBe('strong');
  });

  it('classifies as medium-review on fuzzy name only', () => {
    createContact({
      displayName: 'Peter Wang',
      nicknames: [],
      kids: [],
      handles: [],
      tagIds: [],
    });
    const headers = ['Name', 'notes'];
    const mapping = guessHeaderMapping(headers);
    const mapped = applyMapping(['Peter Wong', 'said hi'], mapping, headers);
    const { matches, status } = classifyRow(mapped);
    expect(status).toBe('review');
    expect(matches[0]?.confidence).toBe('medium');
  });

  it('merges additive fields without overwriting existing prose', () => {
    const id = createContact({
      displayName: 'Jenny Wang',
      nicknames: ['Jen'],
      workCompany: 'Original Co',
      kids: [{ name: 'Lucas', sports: [] }],
      handles: [{ platform: 'email', handle: 'jenny@example.com' }],
      tagIds: [],
    });
    const headers = ['Name', 'email', 'org', 'kid1Name', 'kid1Grade', 'tags'];
    const mapping: ReturnType<typeof guessHeaderMapping> = ['displayName', 'email', 'workCompany', 'kid1Name', 'kid1Grade', 'tags'];
    const mapped = applyMapping(['Jenny Wang', 'jenny@example.com', 'New Co', 'Sophie', '4', 'Pinewood Parents'], mapping, headers);
    commitMerge(id, mapped, 'Imported');
    const detail = getContact(id)!;
    // Existing kid preserved, new kid added
    expect(detail.kids.map((k) => k.name).sort()).toEqual(['Lucas', 'Sophie']);
    // Original company stays (we only fill empty fields)
    expect(detail.contact.workCompany).toBe('Original Co');
    // Tag added
    expect(detail.tags.map((t) => t.name)).toContain('Pinewood Parents');
    // Audit note written
    expect(detail.notes.some((n) => n.body.includes('Imported'))).toBe(true);
  });
});

describe('heuristicExtract', () => {
  it('extracts email and phone from prose', () => {
    const r = heuristicExtract('John works at Acme, john@acme.com, mobile 415-555-1234. Met at the conference.');
    expect(r.email).toBe('john@acme.com');
    expect(r.phone).toBe('4155551234');
    expect(r.displayName).toBe('John');
  });
});
