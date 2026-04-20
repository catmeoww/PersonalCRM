import { listHolidayRows } from '@/lib/services/holiday';
import { listTags } from '@/lib/services/tags';
import { HolidayTable } from './HolidayTable';
import { CopyYearButton } from './CopyYearButton';
import { HolidayTagFilter } from './HolidayTagFilter';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams?: { year?: string; tag?: string } };

export default function HolidayPage({ searchParams }: PageProps) {
  const currentYear = new Date().getFullYear();
  const year = Number(searchParams?.year) || currentYear;
  const tagIds = (searchParams?.tag ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const rows = listHolidayRows(year, tagIds);
  const tags = listTags();

  const sentCount = rows.filter((r) => r.sentThisYear).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Holiday {year}</h1>
        <CopyYearButton fromYear={year - 1} toYear={year} />
      </header>
      <p className="text-sm text-slate-500">
        {sentCount} of {rows.length} marked sent.
      </p>
      <HolidayTagFilter tags={tags} selectedIds={tagIds} year={year} />
      <HolidayTable rows={rows} year={year} />
    </div>
  );
}
