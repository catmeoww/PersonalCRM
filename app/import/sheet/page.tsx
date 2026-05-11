import Link from 'next/link';
import { SheetImportFlow } from './SheetImportFlow';

export default function SheetImportPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Import from Sheet</h1>
        <Link href="/import" className="text-sm text-slate-500 hover:underline">
          ← Back
        </Link>
      </header>
      <p className="text-sm text-slate-500">
        Set the sheet's sharing to <strong>Anyone with the link → Viewer</strong>, then paste the URL.
      </p>
      <SheetImportFlow />
    </div>
  );
}
