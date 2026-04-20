import 'server-only';
import Fuse from 'fuse.js';
import { sqlite } from '@/lib/db/client';
import '@/lib/db/init';
import { getVersion } from './search-index';

type IndexRow = {
  contactId: number;
  displayName: string;
  kind: string;
  token: string;
};

let cache: { version: number; rows: IndexRow[] } | null = null;

function loadIndex(): IndexRow[] {
  const rows = sqlite
    .prepare(
      `SELECT si.contact_id as contactId, c.display_name as displayName, si.kind, si.token
       FROM search_index si JOIN contacts c ON c.id = si.contact_id`,
    )
    .all() as IndexRow[];
  return rows;
}

function getCached(): IndexRow[] {
  const v = getVersion();
  if (!cache || cache.version !== v) {
    cache = { version: v, rows: loadIndex() };
  }
  return cache.rows;
}

function kindWeight(kind: string): number {
  switch (kind) {
    case 'name':
      return 1.0;
    case 'nickname':
      return 0.9;
    case 'kid':
      return 0.8;
    case 'handle':
      return 0.5;
    default:
      return 0.5;
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type VoiceCandidate = {
  contactId: number;
  displayName: string;
  matchedOn: string;
  score: number;
};

export function matchTranscript(transcript: string): VoiceCandidate[] {
  const rows = getCached();
  if (rows.length === 0) return [];

  const q = normalize(transcript);
  if (!q) return [];

  const fuse = new Fuse(rows, {
    keys: ['token'],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const hits = new Map<number, { row: IndexRow; weighted: number; raw: number }>();
  const add = (row: IndexRow, score: number) => {
    const weighted = score / kindWeight(row.kind);
    const prev = hits.get(row.contactId);
    if (!prev || weighted < prev.weighted) {
      hits.set(row.contactId, { row, weighted, raw: score });
    }
  };

  for (const h of fuse.search(q)) add(h.item, h.score ?? 0.5);
  for (const tok of q.split(' ')) {
    if (tok.length < 2) continue;
    for (const h of fuse.search(tok)) add(h.item, h.score ?? 0.5);
  }

  return [...hits.values()]
    .sort((a, b) => a.weighted - b.weighted)
    .slice(0, 3)
    .map((h) => ({
      contactId: h.row.contactId,
      displayName: h.row.displayName,
      matchedOn: `${h.row.kind}:${h.row.token}`,
      score: Math.round(h.weighted * 1000) / 1000,
    }));
}

export function __resetCacheForTests() {
  cache = null;
}
