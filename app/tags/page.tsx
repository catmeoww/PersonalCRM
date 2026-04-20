import { listTags } from '@/lib/services/tags';
import { TAG_CATEGORIES } from '@/lib/db/schema';
import { createTagAction, deleteTagAction } from '@/lib/actions/tags';
import { DeleteTagButton } from './DeleteTagButton';

export const dynamic = 'force-dynamic';

export default function TagsPage() {
  const tags = listTags();
  const byCategory = new Map<string, typeof tags>();
  for (const t of tags) {
    const a = byCategory.get(t.category) ?? [];
    a.push(t);
    byCategory.set(t.category, a);
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="text-sm text-slate-500">
          Group contacts across life-circles: work teams, parents, social, family, custom.
        </p>
      </header>

      <form action={createTagAction} className="card space-y-3">
        <h2 className="text-base font-semibold">New tag</h2>
        <input name="name" required placeholder="Tag name" className="input" />
        <select name="category" className="input" defaultValue="custom">
          {TAG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary w-full">
          Create tag
        </button>
      </form>

      {tags.length === 0 ? (
        <div className="card text-center text-slate-500">No tags yet.</div>
      ) : (
        TAG_CATEGORIES.map((cat) => {
          const list = byCategory.get(cat);
          if (!list || list.length === 0) return null;
          return (
            <section key={cat} className="card">
              <h2 className="text-sm font-semibold capitalize text-slate-600">{cat}</h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2">
                    <span>{t.name}</span>
                    <DeleteTagButton tagId={t.id} name={t.name} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
