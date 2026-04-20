'use client';

import { useTransition } from 'react';
import { copyHolidayYearAction } from '@/lib/actions/holiday';

export function CopyYearButton({ fromYear, toYear }: { fromYear: number; toYear: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Copy ${fromYear} recipients into ${toYear} as pending?`)) return;
        start(async () => {
          const { copied } = await copyHolidayYearAction({ fromYear, toYear });
          alert(`Copied ${copied} recipient${copied === 1 ? '' : 's'} to ${toYear}.`);
        });
      }}
    >
      {pending ? 'Copying…' : `Copy from ${fromYear}`}
    </button>
  );
}
