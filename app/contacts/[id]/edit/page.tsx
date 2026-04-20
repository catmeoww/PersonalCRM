import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactForm } from '@/components/ContactForm';
import { updateContactAction } from '@/lib/actions/contacts';
import { getContact } from '@/lib/services/contacts';
import { listTags } from '@/lib/services/tags';

export const dynamic = 'force-dynamic';

export default function EditContactPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const data = getContact(id);
  if (!data) notFound();
  const tags = listTags();

  const action = updateContactAction.bind(null, id);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit contact</h1>
        <Link href={`/contacts/${id}`} className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </header>
      <ContactForm
        action={action}
        allTags={tags}
        mode="edit"
        initial={{
          id: data.contact.id,
          displayName: data.contact.displayName,
          nicknames: data.contact.nicknames,
          workCompany: data.contact.workCompany,
          workTitle: data.contact.workTitle,
          workTeam: data.contact.workTeam,
          bio: data.contact.bio,
          kids: data.kids,
          handles: data.handles,
          tagIds: data.tags.map((t) => t.id),
        }}
      />
    </div>
  );
}
