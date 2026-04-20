'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { appendNoteAction } from '@/lib/actions/contacts';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Saving…' : 'Add note'}
    </button>
  );
}

export function NoteComposer({ contactId }: { contactId: number }) {
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(fd: FormData) {
    await appendNoteAction(fd);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={onSubmit} className="mt-2 space-y-2">
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="source" value="typed" />
      <textarea
        name="body"
        required
        placeholder="New note…"
        rows={2}
        className="input"
      />
      <SaveBtn />
    </form>
  );
}
