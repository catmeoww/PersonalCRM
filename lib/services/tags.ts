import 'server-only';
import { sqlite } from '@/lib/db/client';
import '@/lib/db/init';
import type { TagCategory } from '@/lib/db/schema';

export type TagRow = { id: number; name: string; category: string; color: string | null };

export function listTags(): TagRow[] {
  return sqlite
    .prepare(`SELECT id, name, category, color FROM tags ORDER BY category, name`)
    .all() as TagRow[];
}

export function createTag(input: { name: string; category: TagCategory; color?: string | null }): TagRow {
  const ins = sqlite
    .prepare(`INSERT INTO tags (name, category, color) VALUES (?, ?, ?)`)
    .run(input.name.trim(), input.category, input.color ?? null);
  const id = Number(ins.lastInsertRowid);
  return { id, name: input.name.trim(), category: input.category, color: input.color ?? null };
}

export function updateTag(id: number, input: { name?: string; category?: TagCategory; color?: string | null }): void {
  sqlite
    .prepare(
      `UPDATE tags SET
         name = COALESCE(?, name),
         category = COALESCE(?, category),
         color = ?
       WHERE id = ?`,
    )
    .run(input.name ?? null, input.category ?? null, input.color ?? null, id);
}

export function deleteTag(id: number): void {
  sqlite.prepare(`DELETE FROM tags WHERE id = ?`).run(id);
}

export function findOrCreateTagByName(name: string, category: TagCategory = 'custom'): TagRow {
  const existing = sqlite
    .prepare(`SELECT id, name, category, color FROM tags WHERE lower(name) = lower(?)`)
    .get(name.trim()) as TagRow | undefined;
  if (existing) return existing;
  return createTag({ name, category });
}
