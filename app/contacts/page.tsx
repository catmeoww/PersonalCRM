import Link from 'next/link';
import { listContacts } from '@/lib/services/contacts';
import { listTags } from '@/lib/services/tags';
import { TagFilterBar } from './TagFilterBar';
import { SearchInput } from './SearchInput';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: { q?: string; tag?: string };
};

export default function ContactsPage({ searchParams }: PageProps) {
  const q = searchParams?.q?.trim() || undefined;
  const tagIds = (searchParams?.tag ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const contacts = listContacts({ q, tagIds });
  const tags = listTags();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex gap-2">
          <Link href="/import" className="btn-secondary">
            Import
          </Link>
          <Link href="/contacts/new" className="btn-primary">
            + New
          </Link>
        </div>
      </header>

      <SearchInput defaultValue={q ?? ''} />
      <TagFilterBar tags={tags} selectedIds={tagIds} />

      {contacts.length === 0 ? (
        <div className="card text-center text-slate-500">
          No contacts yet. Tap <strong>+ New</strong> to add your first.
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <Link href={`/contacts/${c.id}`} className="card block hover:bg-slate-50">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold">{c.displayName}</h2>
                  {c.kidCount > 0 && (
                    <span className="text-xs text-slate-500">
                      {c.kidCount} kid{c.kidCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {c.workCompany && <p className="text-sm text-slate-600">{c.workCompany}</p>}
                {c.tagNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tagNames.map((n) => (
                      <span key={n} className="chip">
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
