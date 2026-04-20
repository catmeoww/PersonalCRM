import Link from 'next/link';
import { ContactForm } from '@/components/ContactForm';
import { createContactAction } from '@/lib/actions/contacts';
import { listTags } from '@/lib/services/tags';

export const dynamic = 'force-dynamic';

export default function NewContactPage() {
  const tags = listTags();
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New contact</h1>
        <Link href="/contacts" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </header>
      <ContactForm action={createContactAction} allTags={tags} mode="create" />
    </div>
  );
}
