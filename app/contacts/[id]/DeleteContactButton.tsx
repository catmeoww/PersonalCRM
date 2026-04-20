'use client';

import { useTransition } from 'react';
import { deleteContactAction } from '@/lib/actions/contacts';

export function DeleteContactButton({ contactId }: { contactId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-danger w-full"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this contact? This cannot be undone.')) return;
        start(() => {
          deleteContactAction(contactId);
        });
      }}
    >
      {pending ? 'Deleting…' : 'Delete contact'}
    </button>
  );
}
