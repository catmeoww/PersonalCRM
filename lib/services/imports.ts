import 'server-only';
import { createHash } from 'node:crypto';
import { sqlite } from '@/lib/db/client';
import '@/lib/db/init';
import { findMatches, type Match } from './match';
import { appendNote, createContact, getContact, updateContact } from './contacts';
import { findOrCreateTagByName } from './tags';
import type { ExtractedContact } from './llm';
import type { ImportField, ReviewRow, RowMapped } from './imports.shared';
export { IMPORT_FIELDS } from './imports.shared';
export type { ImportField, ReviewRow, RowMapped } from './imports.shared';

const HEADER_HEURISTICS: Array<{ field: ImportField; patterns: RegExp[] }> = [
  { field: 'displayName', patterns: [/^name$/i, /^full[\s_-]?name$/i, /^contact$/i, /^person$/i] },
  { field: 'nickname', patterns: [/^nick(name)?$/i, /^alias$/i] },
  { field: 'phone', patterns: [/^phone$/i, /^mobile$/i, /^cell$/i, /^tel$/i, /^number$/i] },
  { field: 'email', patterns: [/^e?-?mail$/i] },
  { field: 'whatsapp', patterns: [/whats?app/i] },
  { field: 'wechat', patterns: [/we[-_\s]?chat/i] },
  { field: 'workCompany', patterns: [/^company$/i, /^org$/i, /organisation/i, /organization/i, /employer/i] },
  { field: 'workTitle', patterns: [/^title$/i, /^role$/i, /^position$/i] },
  { field: 'workTeam', patterns: [/^team$/i, /^department$/i, /^dept$/i] },
  { field: 'bio', patterns: [/^bio$/i, /^about$/i, /^background$/i, /^what$/i] },
  { field: 'tags', patterns: [/^tags?$/i, /categor/i, /^groups?$/i] },
  { field: 'notes', patterns: [/^notes?$/i, /^comment/i, /^remarks?$/i] },
  { field: 'kid1Name', patterns: [/^kid1?[\s_-]?(name)?$/i, /^child1?[\s_-]?(name)?$/i] },
  { field: 'kid1Grade', patterns: [/^kid1?[\s_-]?grade$/i, /^child1?[\s_-]?grade$/i] },
  { field: 'kid1School', patterns: [/^kid1?[\s_-]?school$/i, /^child1?[\s_-]?school$/i] },
  { field: 'kid1Sports', patterns: [/^kid1?[\s_-]?sports?$/i, /^child1?[\s_-]?sports?$/i] },
  { field: 'kid2Name', patterns: [/^kid2[\s_-]?(name)?$/i, /^child2[\s_-]?(name)?$/i] },
  { field: 'kid2Grade', patterns: [/^kid2[\s_-]?grade$/i, /^child2[\s_-]?grade$/i] },
  { field: 'kid2School', patterns: [/^kid2[\s_-]?school$/i, /^child2[\s_-]?school$/i] },
  { field: 'kid2Sports', patterns: [/^kid2[\s_-]?sports?$/i, /^child2[\s_-]?sports?$/i] },
];

export function guessHeaderMapping(headers: string[]): ImportField[] {
  return headers.map((h) => {
    const trimmed = h.trim();
    for (const { field, patterns } of HEADER_HEURISTICS) {
      if (patterns.some((re) => re.test(trimmed))) return field;
    }
    return 'skip' as ImportField;
  });
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function sheetUrlToCsvUrl(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  const gidMatch = input.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function fetchSheetCsv(sheetUrl: string): Promise<{ csv: string; csvUrl: string }> {
  const csvUrl = sheetUrlToCsvUrl(sheetUrl);
  if (!csvUrl) throw new Error('Not a Google Sheets URL.');
  const res = await fetch(csvUrl, { redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}. Make sure sharing is "Anyone with the link".`);
  const csv = await res.text();
  return { csv, csvUrl };
}

function emptyRow(): RowMapped {
  return { nicknames: [], tags: [], notes: [], handles: [], kids: [] };
}

export function applyMapping(values: string[], mapping: ImportField[], headers: string[]): RowMapped {
  const r = emptyRow();
  const kid: Record<1 | 2, RowMapped['kids'][number]> = {
    1: { name: '', sports: [] },
    2: { name: '', sports: [] },
  };
  for (let i = 0; i < mapping.length; i++) {
    const field = mapping[i];
    const raw = (values[i] ?? '').trim();
    if (!field || field === 'skip' || !raw) continue;
    switch (field) {
      case 'displayName':
        r.displayName = raw;
        break;
      case 'nickname':
        r.nicknames.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
        break;
      case 'phone':
        r.phone = raw;
        r.handles.push({ platform: 'sms', handle: raw });
        break;
      case 'email':
        r.email = raw;
        r.handles.push({ platform: 'email', handle: raw });
        break;
      case 'whatsapp':
        r.handles.push({ platform: 'whatsapp', handle: raw });
        break;
      case 'wechat':
        r.handles.push({ platform: 'wechat', handle: raw });
        break;
      case 'workCompany':
        r.workCompany = raw;
        break;
      case 'workTitle':
        r.workTitle = raw;
        break;
      case 'workTeam':
        r.workTeam = raw;
        break;
      case 'bio':
        r.bio = raw;
        break;
      case 'tags':
        r.tags.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
        break;
      case 'notes':
        r.notes.push(`${headers[i] ?? 'note'}: ${raw}`);
        break;
      case 'kid1Name':
        kid[1].name = raw;
        break;
      case 'kid1Grade':
        kid[1].grade = raw;
        break;
      case 'kid1School':
        kid[1].school = raw;
        break;
      case 'kid1Sports':
        kid[1].sports = raw.split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case 'kid2Name':
        kid[2].name = raw;
        break;
      case 'kid2Grade':
        kid[2].grade = raw;
        break;
      case 'kid2School':
        kid[2].school = raw;
        break;
      case 'kid2Sports':
        kid[2].sports = raw.split(',').map((s) => s.trim()).filter(Boolean);
        break;
    }
  }
  for (const k of [kid[1], kid[2]]) if (k.name) r.kids.push(k);
  return r;
}

export function rowMappedFromExtracted(x: ExtractedContact): RowMapped {
  const r = emptyRow();
  r.displayName = x.displayName;
  r.nicknames = x.nicknames ?? [];
  r.workCompany = x.workCompany;
  r.workTitle = x.workTitle;
  r.workTeam = x.workTeam;
  r.bio = x.bio;
  r.phone = x.phone;
  r.email = x.email;
  if (x.phone) r.handles.push({ platform: 'sms', handle: x.phone });
  if (x.email) r.handles.push({ platform: 'email', handle: x.email });
  for (const h of x.handles ?? []) r.handles.push({ platform: h.platform, handle: h.handle });
  for (const k of x.kids ?? []) r.kids.push({ name: k.name, grade: k.grade, school: k.school, sports: k.sports ?? [] });
  r.tags = x.tags ?? [];
  if (x.summary) r.notes.push(x.summary);
  return r;
}

export function classifyRow(mapped: RowMapped): { matches: Match[]; status: ReviewRow['defaultStatus']; defaultMatchId?: number } {
  const matches = findMatches({
    displayName: mapped.displayName,
    nicknames: mapped.nicknames,
    phone: mapped.phone,
    email: mapped.email,
    handles: mapped.handles,
    kids: mapped.kids.map((k) => ({ name: k.name })),
  });
  if (!mapped.displayName && matches.length === 0) {
    return { matches, status: 'create' };
  }
  if (matches.length === 0) return { matches, status: 'create' };
  const top = matches[0]!;
  if (top.confidence === 'strong') return { matches, status: 'auto_merge', defaultMatchId: top.contactId };
  return { matches, status: 'review', defaultMatchId: top.contactId };
}

export function hashRow(values: string[]): string {
  return createHash('sha1').update(values.join('')).digest('hex').slice(0, 16);
}

export function startImportRun(input: {
  sourceType: 'sheet' | 'text';
  sourceUrl?: string;
  sourceLabel?: string;
  columnMap?: ImportField[];
  rowsTotal: number;
}): number {
  const ins = sqlite
    .prepare(
      `INSERT INTO import_runs (source_type, source_url, source_label, column_map_json, rows_total)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.sourceType,
      input.sourceUrl ?? null,
      input.sourceLabel ?? null,
      input.columnMap ? JSON.stringify(input.columnMap) : null,
      input.rowsTotal,
    );
  return Number(ins.lastInsertRowid);
}

export function recordImportRow(input: {
  importRunId: number;
  rowIndex: number;
  rowHash: string;
  raw: unknown;
  parsed: RowMapped;
  matchedContactId: number | null;
  status: string;
  decision: string;
}): void {
  sqlite
    .prepare(
      `INSERT INTO import_rows (import_run_id, row_index, row_hash, raw_json, parsed_json, matched_contact_id, status, decision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.importRunId,
      input.rowIndex,
      input.rowHash,
      JSON.stringify(input.raw),
      JSON.stringify(input.parsed),
      input.matchedContactId,
      input.status,
      input.decision,
    );
}

export function finishImportRun(id: number, counts: { created: number; merged: number; skipped: number }): void {
  sqlite
    .prepare(
      `UPDATE import_runs SET completed_at = ?, rows_created = ?, rows_merged = ?, rows_skipped = ? WHERE id = ?`,
    )
    .run(Date.now(), counts.created, counts.merged, counts.skipped, id);
}

export function commitCreate(mapped: RowMapped, sourceNote: string): number {
  const tagIds: number[] = [];
  for (const name of mapped.tags) {
    const t = findOrCreateTagByName(name, 'custom');
    tagIds.push(t.id);
  }
  const id = createContact({
    displayName: mapped.displayName ?? 'Unnamed',
    nicknames: mapped.nicknames,
    workCompany: mapped.workCompany,
    workTitle: mapped.workTitle,
    workTeam: mapped.workTeam,
    bio: mapped.bio,
    kids: mapped.kids.map((k) => ({
      name: k.name,
      grade: k.grade,
      school: k.school,
      sports: k.sports,
      interests: undefined,
    })),
    handles: mapped.handles.map((h) => ({
      platform: h.platform as 'whatsapp' | 'wechat' | 'imessage' | 'sms' | 'email' | 'other',
      handle: h.handle,
    })),
    tagIds,
  });
  const noteBody = [sourceNote, ...mapped.notes].filter(Boolean).join('\n');
  if (noteBody) appendNote(id, noteBody, 'typed');
  return id;
}

export function commitMerge(targetId: number, mapped: RowMapped, sourceNote: string): void {
  const existing = getContact(targetId);
  if (!existing) throw new Error('contact gone');

  const mergedNicknames = uniqStr([...existing.contact.nicknames, ...mapped.nicknames]);
  const mergedKids = [...existing.kids.map((k) => ({
    name: k.name,
    grade: k.grade ?? undefined,
    school: k.school ?? undefined,
    sports: k.sports,
    interests: k.interests ?? undefined,
  }))];
  for (const k of mapped.kids) {
    if (!mergedKids.some((existing) => existing.name.toLowerCase() === k.name.toLowerCase())) {
      mergedKids.push({ name: k.name, grade: k.grade, school: k.school, sports: k.sports, interests: undefined });
    }
  }
  const mergedHandles = [...existing.handles.map((h) => ({
    platform: h.platform as 'whatsapp' | 'wechat' | 'imessage' | 'sms' | 'email' | 'other',
    handle: h.handle,
    displayName: h.displayName ?? undefined,
  }))];
  for (const h of mapped.handles) {
    if (!mergedHandles.some((e) => e.platform === h.platform && e.handle.trim().toLowerCase() === h.handle.trim().toLowerCase())) {
      mergedHandles.push({
        platform: h.platform as 'whatsapp' | 'wechat' | 'imessage' | 'sms' | 'email' | 'other',
        handle: h.handle,
        displayName: undefined,
      });
    }
  }
  const mergedTagIds = new Set(existing.tags.map((t) => t.id));
  for (const name of mapped.tags) {
    const t = findOrCreateTagByName(name, 'custom');
    mergedTagIds.add(t.id);
  }

  const fillIfEmpty = (cur: string | null, next?: string) => (cur && cur.trim() ? cur : next ?? cur);
  updateContact(targetId, {
    displayName: existing.contact.displayName,
    nicknames: mergedNicknames,
    workCompany: fillIfEmpty(existing.contact.workCompany, mapped.workCompany) ?? undefined,
    workTitle: fillIfEmpty(existing.contact.workTitle, mapped.workTitle) ?? undefined,
    workTeam: fillIfEmpty(existing.contact.workTeam, mapped.workTeam) ?? undefined,
    bio: fillIfEmpty(existing.contact.bio, mapped.bio) ?? undefined,
    kids: mergedKids,
    handles: mergedHandles,
    tagIds: [...mergedTagIds],
  });

  const noteBody = [sourceNote, ...mapped.notes].filter(Boolean).join('\n');
  if (noteBody) appendNote(targetId, noteBody, 'typed');
}

function uniqStr(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}
