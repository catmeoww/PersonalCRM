import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { searchIndex } from '@/lib/db/schema';
import type { HandleInput, KidInput } from '@/lib/validation/contacts';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function normalizePhone(s: string): string {
  return s.replace(/\D+/g, '');
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function buildSearchTokens(input: {
  contactId: number;
  displayName: string;
  nicknames: string[];
  kids: Array<Pick<KidInput, 'name'>>;
  handles: Array<{ platform: string; handle: string; displayName?: string | null }>;
}) {
  const rows: Array<{ contactId: number; kind: string; token: string }> = [];
  const push = (kind: string, token: string) => {
    const t = norm(token);
    if (t.length === 0) return;
    rows.push({ contactId: input.contactId, kind, token: t });
  };

  push('name', input.displayName);
  for (const part of input.displayName.split(/\s+/)) push('name', part);
  for (const n of input.nicknames) push('nickname', n);
  for (const k of input.kids) {
    push('kid', k.name);
    for (const part of k.name.split(/\s+/)) push('kid', part);
  }
  for (const h of input.handles) {
    if (h.platform === 'email') {
      push('email', normalizeEmail(h.handle));
    } else if (h.platform === 'sms' || h.platform === 'imessage') {
      const digits = normalizePhone(h.handle);
      if (digits) push('phone', digits);
    } else {
      push('handle', h.handle);
    }
    if (h.displayName) push('handle', h.displayName);
  }
  return rows;
}

export function rebuildSearchIndexFor(contactId: number, rows: ReturnType<typeof buildSearchTokens>) {
  db.delete(searchIndex).where(eq(searchIndex.contactId, contactId)).run();
  if (rows.length === 0) return;
  db.insert(searchIndex).values(rows).run();
  bumpVersion();
}

let version = 0;
export function bumpVersion() {
  version += 1;
}
export function getVersion() {
  return version;
}
