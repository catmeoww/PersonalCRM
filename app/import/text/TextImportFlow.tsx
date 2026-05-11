'use client';

import { useState, useTransition } from 'react';
import { commitTextAction, extractTextAction, type TextExtractResponse } from '@/lib/actions/imports';
import type { Match } from '@/lib/services/imports.shared';

type Stage = 'paste' | 'review' | 'done';

export function TextImportFlow() {
  const [stage, setStage] = useState<Stage>('paste');
  const [text, setText] = useState('');
  const [data, setData] = useState<TextExtractResponse | null>(null);
  const [decision, setDecision] = useState<'merge' | 'create' | 'skip'>('create');
  const [mergeId, setMergeId] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<{ contactId?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onExtract() {
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set('text', text);
      const res = await extractTextAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData(res.data);
      setDecision(res.data.defaultStatus === 'auto_merge' ? 'merge' : res.data.defaultStatus === 'create' ? 'create' : 'merge');
      setMergeId(res.data.defaultMatchId);
      setStage('review');
    });
  }

  function onCommit() {
    if (!data) return;
    start(async () => {
      setError(null);
      const res = await commitTextAction({
        decision,
        mergeIntoId: mergeId,
        mapped: data.mapped,
        originalText: data.originalText,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ contactId: res.contactId });
      setStage('done');
    });
  }

  function pickMatch(m: Match) {
    setDecision('merge');
    setMergeId(m.contactId);
  }

  function reset() {
    setStage('paste');
    setText('');
    setData(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {error && <div className="card border-red-300 bg-red-50 text-sm text-red-700">{error}</div>}

      {stage === 'paste' && (
        <div className="card space-y-3">
          <label className="label" htmlFor="text">
            Paste freeform text
          </label>
          <textarea
            id="text"
            className="input"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Met Jenny Wang at the Pinewood spring party. Her son Lucas is in 2nd grade, plays soccer. She works at Google in the Ads team. WeChat is jenny_w88.`}
          />
          <button onClick={onExtract} disabled={pending || !text.trim()} className="btn-primary w-full">
            {pending ? 'Extracting…' : 'Extract & match'}
          </button>
        </div>
      )}

      {stage === 'review' && data && (
        <div className="space-y-4">
          {data.source === 'fallback' && (
            <div className="card border-yellow-300 bg-yellow-50 text-sm">
              <strong>Heads-up:</strong> Claude was unavailable, fell back to heuristic extraction. The text is preserved as a note, but structured fields may be missing.
              {data.warning && <p className="mt-1 text-xs text-yellow-700">({data.warning})</p>}
            </div>
          )}

          <div className="card space-y-2">
            <h2 className="text-base font-semibold">Extracted</h2>
            <Field label="Name" value={data.mapped.displayName} editable onChange={(v) => updateField('displayName', v)} />
            <Field label="Company" value={data.mapped.workCompany} editable onChange={(v) => updateField('workCompany', v)} />
            <Field label="Title" value={data.mapped.workTitle} editable onChange={(v) => updateField('workTitle', v)} />
            <Field label="Team" value={data.mapped.workTeam} editable onChange={(v) => updateField('workTeam', v)} />
            <Field label="Phone" value={data.mapped.phone} editable onChange={(v) => updateField('phone', v)} />
            <Field label="Email" value={data.mapped.email} editable onChange={(v) => updateField('email', v)} />
            {data.mapped.kids.length > 0 && (
              <div>
                <p className="label">Kids</p>
                <ul className="space-y-1 text-sm">
                  {data.mapped.kids.map((k, i) => (
                    <li key={i} className="rounded border border-slate-200 p-2">
                      <strong>{k.name}</strong>
                      {k.grade && <> · grade {k.grade}</>}
                      {k.school && <> · {k.school}</>}
                      {k.sports.length > 0 && <> · {k.sports.join(', ')}</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.mapped.tags.length > 0 && (
              <div>
                <p className="label">Tags</p>
                <p className="text-sm">{data.mapped.tags.join(', ')}</p>
              </div>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-slate-600">Source text</summary>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{data.originalText}</p>
            </details>
          </div>

          <div className="card space-y-3">
            <h2 className="text-base font-semibold">Decision</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDecision('merge')}
                disabled={!mergeId}
                className={`btn-secondary ${decision === 'merge' ? 'ring-2 ring-brand-500' : ''}`}
              >
                Merge
              </button>
              <button
                onClick={() => setDecision('create')}
                className={`btn-secondary ${decision === 'create' ? 'ring-2 ring-brand-500' : ''}`}
              >
                Create new
              </button>
              <button
                onClick={() => setDecision('skip')}
                className={`btn-secondary ${decision === 'skip' ? 'ring-2 ring-brand-500' : ''}`}
              >
                Skip
              </button>
            </div>

            {data.matches.length > 0 ? (
              <div>
                <p className="label">Candidates</p>
                <ul className="space-y-1">
                  {data.matches.map((m) => (
                    <li
                      key={m.contactId}
                      className={`rounded border p-2 text-sm ${
                        decision === 'merge' && mergeId === m.contactId ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                      }`}
                    >
                      <button className="w-full text-left" onClick={() => pickMatch(m)}>
                        <div className="flex items-baseline justify-between">
                          <strong>{m.displayName}</strong>
                          <span className="text-xs text-slate-500">
                            {m.confidence} · {m.score}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{m.reasons.join('; ')}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No existing contact matches — this will create a new one.</p>
            )}
          </div>

          <div className="sticky bottom-20 z-10 flex gap-2 pb-2">
            <button onClick={reset} className="btn-secondary flex-1" disabled={pending}>
              ← Re-paste
            </button>
            <button onClick={onCommit} className="btn-primary flex-1" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="card space-y-2">
          <h2 className="text-base font-semibold">Saved</h2>
          {result.contactId ? (
            <a href={`/contacts/${result.contactId}`} className="btn-primary inline-block">
              View contact
            </a>
          ) : (
            <p className="text-sm text-slate-500">Skipped.</p>
          )}
          <button onClick={reset} className="btn-secondary">
            Import another
          </button>
        </div>
      )}
    </div>
  );

  function updateField<K extends keyof TextExtractResponse['mapped']>(k: K, v: string) {
    if (!data) return;
    const next = { ...data, mapped: { ...data.mapped, [k]: v } };
    setData(next);
  }
}

function Field({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string | undefined;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      {editable ? (
        <input className="input" value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} />
      ) : (
        <p className="text-sm">{value || '—'}</p>
      )}
    </div>
  );
}
