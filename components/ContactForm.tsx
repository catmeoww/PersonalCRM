'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import clsx from 'clsx';
import { PLATFORMS } from '@/lib/db/schema';

type Tag = { id: number; name: string; category: string };

export type ContactFormInitial = {
  id?: number;
  displayName?: string;
  nicknames?: string[];
  workCompany?: string | null;
  workTitle?: string | null;
  workTeam?: string | null;
  bio?: string | null;
  kids?: Array<{
    name?: string;
    grade?: string | null;
    school?: string | null;
    sports?: string[];
    interests?: string | null;
  }>;
  handles?: Array<{ platform?: string; handle?: string; displayName?: string | null }>;
  tagIds?: number[];
};

type Props = {
  action: (fd: FormData) => void | Promise<void>;
  initial?: ContactFormInitial;
  allTags: Tag[];
  mode: 'create' | 'edit';
};

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function ContactForm({ action, initial, allTags, mode }: Props) {
  const [kids, setKids] = useState(
    initial?.kids && initial.kids.length
      ? initial.kids
      : [{ name: '', grade: '', school: '', sports: [], interests: '' }],
  );
  const [handles, setHandles] = useState(
    initial?.handles && initial.handles.length
      ? initial.handles
      : [{ platform: 'whatsapp', handle: '', displayName: '' }],
  );
  const [tagIds, setTagIds] = useState<Set<number>>(new Set(initial?.tagIds ?? []));

  function addKid() {
    setKids((k) => [...k, { name: '', grade: '', school: '', sports: [], interests: '' }]);
  }
  function removeKid(i: number) {
    setKids((k) => k.filter((_, idx) => idx !== i));
  }
  function addHandle() {
    setHandles((h) => [...h, { platform: 'whatsapp', handle: '', displayName: '' }]);
  }
  function removeHandle(i: number) {
    setHandles((h) => h.filter((_, idx) => idx !== i));
  }
  function toggleTag(id: number) {
    setTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="text-base font-semibold">Basics</h2>
        <div>
          <label className="label" htmlFor="displayName">
            Name
          </label>
          <input
            id="displayName"
            name="displayName"
            defaultValue={initial?.displayName ?? ''}
            required
            className="input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="nicknames">
            Nicknames (comma-separated)
          </label>
          <input
            id="nicknames"
            name="nicknames"
            defaultValue={initial?.nicknames?.join(', ') ?? ''}
            className="input"
            placeholder="e.g. Jen, Jenny W"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="workCompany">
              Company
            </label>
            <input id="workCompany" name="workCompany" defaultValue={initial?.workCompany ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="workTeam">
              Team
            </label>
            <input id="workTeam" name="workTeam" defaultValue={initial?.workTeam ?? ''} className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="workTitle">
            Title
          </label>
          <input id="workTitle" name="workTitle" defaultValue={initial?.workTitle ?? ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bio">
            Bio / background
          </label>
          <textarea id="bio" name="bio" defaultValue={initial?.bio ?? ''} className="input" rows={3} />
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Kids</h2>
          <button type="button" onClick={addKid} className="btn-secondary">
            + Add kid
          </button>
        </div>
        {kids.map((k, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input
                name="kid_name[]"
                defaultValue={k.name ?? ''}
                placeholder="Name"
                className="input col-span-2"
              />
              <input
                name="kid_grade[]"
                defaultValue={k.grade ?? ''}
                placeholder="Grade (K, 1, 2…)"
                className="input"
              />
            </div>
            <input
              name="kid_school[]"
              defaultValue={k.school ?? ''}
              placeholder="School"
              className="input"
            />
            <input
              name="kid_sports[]"
              defaultValue={(k.sports ?? []).join(', ')}
              placeholder="Sports (comma separated)"
              className="input"
            />
            <input
              name="kid_interests[]"
              defaultValue={k.interests ?? ''}
              placeholder="Interests"
              className="input"
            />
            {kids.length > 1 && (
              <button
                type="button"
                onClick={() => removeKid(i)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Messaging handles</h2>
          <button type="button" onClick={addHandle} className="btn-secondary">
            + Add handle
          </button>
        </div>
        {handles.map((h, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <select name="handle_platform[]" defaultValue={h.platform ?? 'whatsapp'} className="input">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                name="handle_value[]"
                defaultValue={h.handle ?? ''}
                placeholder="Handle / number / id"
                className="input col-span-2"
              />
            </div>
            <input
              name="handle_name[]"
              defaultValue={h.displayName ?? ''}
              placeholder="Display name (optional)"
              className="input"
            />
            {handles.length > 1 && (
              <button
                type="button"
                onClick={() => removeHandle(i)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold">Tags</h2>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => {
              const active = tagIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={clsx('chip cursor-pointer select-none', active && 'chip-active')}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
        {[...tagIds].map((id) => (
          <input key={id} type="hidden" name="tag_id[]" value={id} />
        ))}
        <div>
          <label className="label" htmlFor="new_tags">
            New tags (comma-separated)
          </label>
          <input
            id="new_tags"
            name="new_tags"
            className="input"
            placeholder="e.g. Pinewood Parents, Grade 2"
          />
        </div>
      </section>

      {mode === 'create' && (
        <section className="card space-y-3">
          <h2 className="text-base font-semibold">First note (optional)</h2>
          <textarea
            name="firstNote"
            className="input"
            rows={3}
            placeholder="Where you met, what you learned…"
          />
        </section>
      )}

      <div className="sticky bottom-20 z-10 pb-2">
        <SubmitBtn label={mode === 'create' ? 'Save contact' : 'Save changes'} />
      </div>
    </form>
  );
}
