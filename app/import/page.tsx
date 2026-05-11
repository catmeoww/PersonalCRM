import Link from 'next/link';

export default function ImportLandingPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Import contacts</h1>
        <p className="text-sm text-slate-500">
          Bring contacts in from a Google Sheet, or paste freeform notes and let the app figure out who they're about.
        </p>
      </header>

      <Link href="/import/sheet" className="card block hover:bg-slate-50">
        <h2 className="text-base font-semibold">📄 From a Google Sheet</h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste a share URL, map columns, and review matches before committing.
        </p>
      </Link>

      <Link href="/import/text" className="card block hover:bg-slate-50">
        <h2 className="text-base font-semibold">✍️ From freeform text</h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste a note about a person — the app extracts names, work, kids, and links it to an existing contact when possible.
        </p>
      </Link>
    </div>
  );
}
