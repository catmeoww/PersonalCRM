import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getContact } from '@/lib/services/contacts';
import { NoteComposer } from './NoteComposer';
import { DeleteContactButton } from './DeleteContactButton';

export const dynamic = 'force-dynamic';

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const data = getContact(id);
  if (!data) notFound();
  const { contact, kids, handles, tags, notes } = data;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href="/contacts" className="text-sm text-slate-500 hover:underline">
            ← Contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{contact.displayName}</h1>
          {contact.nicknames.length > 0 && (
            <p className="text-sm text-slate-500">a.k.a. {contact.nicknames.join(', ')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/contacts/${contact.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        </div>
      </header>

      {(contact.workCompany || contact.workTitle || contact.workTeam) && (
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-600">Work</h2>
          <p className="mt-1">
            {[contact.workTitle, contact.workTeam, contact.workCompany].filter(Boolean).join(' · ')}
          </p>
        </section>
      )}

      {contact.bio && (
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-600">Bio</h2>
          <p className="mt-1 whitespace-pre-wrap">{contact.bio}</p>
        </section>
      )}

      {kids.length > 0 && (
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-600">Kids</h2>
          <ul className="mt-2 space-y-2">
            {kids.map((k) => (
              <li key={k.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-baseline justify-between">
                  <strong>{k.name}</strong>
                  {k.grade && <span className="text-xs text-slate-500">Grade {k.grade}</span>}
                </div>
                {k.school && <p className="text-sm text-slate-600">{k.school}</p>}
                {k.sports.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {k.sports.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {k.interests && <p className="mt-1 text-sm text-slate-600">{k.interests}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {handles.length > 0 && (
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-600">Messaging</h2>
          <ul className="mt-2 space-y-1">
            {handles.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between text-sm">
                <span className="font-medium capitalize">{h.platform}</span>
                <span className="text-slate-700">{h.handle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-600">Tags</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className="chip">
                {t.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-600">Add note</h2>
        <NoteComposer contactId={contact.id} />
      </section>

      <section className="card">
        <h2 className="text-sm font-semibold text-slate-600">Notes timeline</h2>
        {notes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No notes yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-200 p-3">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(n.createdAt).toLocaleString()} · {n.source}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeleteContactButton contactId={contact.id} />
    </div>
  );
}
