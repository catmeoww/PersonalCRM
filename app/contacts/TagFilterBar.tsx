'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';

type Tag = { id: number; name: string; category: string };

export function TagFilterBar({ tags, selectedIds }: { tags: Tag[]; selectedIds: number[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const selected = new Set(selectedIds);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const newParams = new URLSearchParams(params.toString());
    if (next.size === 0) newParams.delete('tag');
    else newParams.set('tag', [...next].join(','));
    router.replace(`/contacts?${newParams.toString()}`);
  }

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <button
          key={t.id}
          onClick={() => toggle(t.id)}
          className={clsx('chip cursor-pointer select-none', selected.has(t.id) && 'chip-active')}
          type="button"
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
