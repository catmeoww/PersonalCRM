'use client';

import { useTransition } from 'react';
import { deleteTagAction } from '@/lib/actions/tags';

export function DeleteTagButton({ tagId, name }: { tagId: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete tag "${name}"? It will be removed from all contacts.`)) return;
        start(() => {
          deleteTagAction(tagId);
        });
      }}
      className="text-sm text-red-600 hover:underline disabled:text-slate-400"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
