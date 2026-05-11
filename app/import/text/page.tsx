import Link from 'next/link';
import { TextImportFlow } from './TextImportFlow';

export default function TextImportPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Import from text</h1>
        <Link href="/import" className="text-sm text-slate-500 hover:underline">
          ← Back
        </Link>
      </header>
      <p className="text-sm text-slate-500">
        Paste anything you know about a person. The app extracts structured fields and finds the matching contact.
      </p>
      <TextImportFlow />
    </div>
  );
}
