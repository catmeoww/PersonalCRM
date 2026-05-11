import 'server-only';
import Fuse from 'fuse.js';
import { sqlite } from '@/lib/db/client';
import '@/lib/db/init';
import { normalizeEmail, normalizePhone } from './search-index';
import type { Match } from './imports.shared';

export type { Match };

export type CandidateInput = {
  displayName?: string;
  nicknames?: string[];
  phone?: string;
  email?: string;
  handles?: Array<{ platform: string; handle: string }>;
  kids?: Array<{ name: string }>;
};

type IndexRow = {
  contactId: number;
  displayName: string;
  kind: string;
  token: string;
};

function loadIndex(): IndexRow[] {
  return sqlite
    .prepare(
      `SELECT si.contact_id as contactId, c.display_name as displayName, si.kind, si.token
       FROM search_index si JOIN contacts c ON c.id = si.contact_id`,
    )
    .all() as IndexRow[];
}

export function findMatches(input: CandidateInput, opts: { limit?: number } = {}): Match[] {
  const limit = opts.limit ?? 5;
  const rows = loadIndex();
  if (rows.length === 0) return [];

  const reasonsByContact = new Map<number, { displayName: string; reasons: string[]; score: number; strong: boolean }>();
  const bump = (cid: number, displayName: string, reason: string, addScore: number, strong = false) => {
    const prev = reasonsByContact.get(cid) ?? { displayName, reasons: [], score: 0, strong: false };
    prev.reasons.push(reason);
    prev.score += addScore;
    if (strong) prev.strong = true;
    reasonsByContact.set(cid, prev);
  };

  if (input.phone) {
    const norm = normalizePhone(input.phone);
    if (norm) {
      for (const r of rows) if (r.kind === 'phone' && r.token === norm) bump(r.contactId, r.displayName, `phone match`, 2.0, true);
    }
  }
  if (input.email) {
    const norm = normalizeEmail(input.email);
    for (const r of rows) if (r.kind === 'email' && r.token === norm) bump(r.contactId, r.displayName, `email match`, 2.0, true);
  }
  for (const h of input.handles ?? []) {
    if (h.platform === 'email') {
      const norm = normalizeEmail(h.handle);
      for (const r of rows) if (r.kind === 'email' && r.token === norm) bump(r.contactId, r.displayName, `email match`, 2.0, true);
    } else if (h.platform === 'sms' || h.platform === 'imessage') {
      const norm = normalizePhone(h.handle);
      if (norm) for (const r of rows) if (r.kind === 'phone' && r.token === norm) bump(r.contactId, r.displayName, `phone match`, 2.0, true);
    } else {
      const lc = h.handle.trim().toLowerCase();
      for (const r of rows) if (r.kind === 'handle' && r.token === lc) bump(r.contactId, r.displayName, `${h.platform} handle match`, 1.5, true);
    }
  }

  const fuseRows = rows.filter((r) => ['name', 'nickname', 'kid'].includes(r.kind));
  const fuse = new Fuse(fuseRows, {
    keys: ['token'],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const fuzzyHit = (query: string, label: string, weight: number) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    for (const h of fuse.search(q)) {
      const s = 1 - (h.score ?? 0.5);
      bump(h.item.contactId, h.item.displayName, `${label} fuzzy ${h.item.kind}:${h.item.token}`, s * weight);
    }
  };

  if (input.displayName) fuzzyHit(input.displayName, 'name', 1.0);
  for (const n of input.nicknames ?? []) fuzzyHit(n, 'nickname', 0.8);
  for (const k of input.kids ?? []) fuzzyHit(k.name, 'kid', 0.7);

  const list: Match[] = [];
  for (const [cid, v] of reasonsByContact) {
    let confidence: Match['confidence'] = 'weak';
    if (v.strong) confidence = 'strong';
    else if (v.score >= 0.5) confidence = 'medium';
    list.push({ contactId: cid, displayName: v.displayName, confidence, reasons: v.reasons, score: Math.round(v.score * 100) / 100 });
  }
  return list
    .sort((a, b) => {
      const order = { strong: 0, medium: 1, weak: 2 } as const;
      if (order[a.confidence] !== order[b.confidence]) return order[a.confidence] - order[b.confidence];
      return b.score - a.score;
    })
    .slice(0, limit);
}
