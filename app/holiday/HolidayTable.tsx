'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { toggleHolidayAction } from '@/lib/actions/holiday';

type Row = {
  contactId: number;
  displayName: string;
  tagNames: string[];
  sentThisYear: boolean;
  sentLastYear: boolean;
  channel: string | null;
  notes: string | null;
};

export function HolidayTable({ rows, year }: { rows: Row[]; year: number }) {
  const [pending, start] = useTransition();

  if (rows.length === 0) {
    return <div className="card text-center text-slate-500">No contacts match.</div>;
  }

  function toggle(r: Row) {
    start(async () => {
      await toggleHolidayAction({
        contactId: r.contactId,
        year,
        sent: !r.sentThisYear,
        channel: r.channel ?? null,
        notes: r.notes ?? null,
      });
    });
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.contactId} className="card flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline">
              {r.displayName}
            </Link>
            {r.tagNames.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.tagNames.map((n) => (
                  <span key={n} className="chip">
                    {n}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Last year: {r.sentLastYear ? 'sent' : 'not sent'}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(r)}
            className={
              r.sentThisYear
                ? 'btn bg-green-600 text-white hover:bg-green-700'
                : 'btn-secondary'
            }
            aria-pressed={r.sentThisYear}
          >
            {r.sentThisYear ? '✓ Sent' : 'Mark sent'}
          </button>
        </li>
      ))}
    </ul>
  );
}
