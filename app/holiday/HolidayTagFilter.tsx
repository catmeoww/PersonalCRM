'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';

type Tag = { id: number; name: string };

export function HolidayTagFilter({
  tags,
  selectedIds,
  year,
}: {
  tags: Tag[];
  selectedIds: number[];
  year: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const selected = new Set(selectedIds);
  if (tags.length === 0) return null;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const np = new URLSearchParams(params.toString());
    np.set('year', String(year));
    if (next.size === 0) np.delete('tag');
    else np.set('tag', [...next].join(','));
    router.replace(`/holiday?${np.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle(t.id)}
          className={clsx('chip cursor-pointer select-none', selected.has(t.id) && 'chip-active')}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
