'use client';

import { useState, useTransition } from 'react';
import {
  commitSheetAction,
  dryRunSheetAction,
  previewSheetAction,
  type CommitDecision,
  type DryRunResponse,
  type PreviewResponse,
} from '@/lib/actions/imports';
import { IMPORT_FIELDS, type ImportField, type ReviewRow } from '@/lib/services/imports.shared';

type Stage = 'url' | 'mapping' | 'review' | 'done';

export function SheetImportFlow() {
  const [stage, setStage] = useState<Stage>('url');
  const [sheetUrl, setSheetUrl] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [dryRun, setDryRun] = useState<DryRunResponse | null>(null);
  const [decisions, setDecisions] = useState<Map<number, CommitDecision>>(new Map());
  const [result, setResult] = useState<{ created: number; merged: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onPreview(formData: FormData) {
    start(async () => {
      setError(null);
      const url = String(formData.get('sheetUrl') ?? '');
      const res = await previewSheetAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSheetUrl(url);
      setPreview(res.data);
      setMapping(res.data.defaultMapping);
      setStage('mapping');
    });
  }

  function onDryRun() {
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set('sheetUrl', sheetUrl);
      fd.set('mapping', JSON.stringify(mapping));
      const res = await dryRunSheetAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDryRun(res.data);
      setDecisions(new Map());
      setStage('review');
    });
  }

  function setDecision(rowIndex: number, decision: CommitDecision) {
    setDecisions((m) => {
      const next = new Map(m);
      next.set(rowIndex, decision);
      return next;
    });
  }

  function onCommit() {
    if (!dryRun) return;
    start(async () => {
      setError(null);
      const decisionList: CommitDecision[] = [];
      decisions.forEach((d) => decisionList.push(d));
      const res = await commitSheetAction({
        sourceUrl: sheetUrl,
        mapping,
        rows: dryRun.rows,
        decisions: decisionList,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ created: res.created, merged: res.merged, skipped: res.skipped });
      setStage('done');
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="card border-red-300 bg-red-50 text-sm text-red-700">{error}</div>}

      {stage === 'url' && (
        <form action={onPreview} className="card space-y-3">
          <label className="label" htmlFor="sheetUrl">
            Google Sheets URL
          </label>
          <input
            id="sheetUrl"
            name="sheetUrl"
            required
            className="input"
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
          />
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'Fetching…' : 'Preview sheet'}
          </button>
        </form>
      )}

      {stage === 'mapping' && preview && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold">Map columns</h2>
            <p className="mt-1 text-sm text-slate-500">
              {preview.rowCount} row{preview.rowCount === 1 ? '' : 's'} found. Tell the app what each column means.
            </p>
            <div className="mt-3 grid gap-3">
              {preview.headers.map((h, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium">{h || `(column ${i + 1})`}</p>
                  <p className="text-xs text-slate-500">
                    Sample: {preview.preview.map((r) => r[i] ?? '').filter(Boolean).slice(0, 2).join(' / ') || '—'}
                  </p>
                  <select
                    value={mapping[i] ?? 'skip'}
                    onChange={(e) => {
                      const next = [...mapping];
                      next[i] = e.target.value as ImportField;
                      setMapping(next);
                    }}
                    className="input mt-2"
                  >
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStage('url')} className="btn-secondary flex-1" disabled={pending}>
              ← Back
            </button>
            <button onClick={onDryRun} className="btn-primary flex-1" disabled={pending}>
              {pending ? 'Analyzing…' : 'Dry run'}
            </button>
          </div>
        </div>
      )}

      {stage === 'review' && dryRun && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold">Review</h2>
            <p className="mt-1 text-sm">
              ✅ <strong>{dryRun.counts.autoMerge}</strong> auto-merge ·
              ❓ <strong>{dryRun.counts.review}</strong> review ·
              ➕ <strong>{dryRun.counts.create}</strong> create
            </p>
          </div>
          <ul className="space-y-2">
            {dryRun.rows.map((row) => {
              const decision =
                decisions.get(row.rowIndex)?.decision ??
                (row.defaultStatus === 'auto_merge' ? 'merge' : row.defaultStatus === 'create' ? 'create' : 'skip');
              const matchId = decisions.get(row.rowIndex)?.mergeIntoId ?? row.defaultMatchId;
              return (
                <li key={row.rowIndex} className="card space-y-2">
                  <div className="flex items-baseline justify-between">
                    <strong className="text-sm">
                      {row.mapped.displayName || `(row ${row.rowIndex + 1})`}
                    </strong>
                    <span
                      className={
                        row.defaultStatus === 'auto_merge'
                          ? 'chip bg-green-100 text-green-800'
                          : row.defaultStatus === 'create'
                            ? 'chip bg-blue-100 text-blue-800'
                            : 'chip bg-yellow-100 text-yellow-800'
                      }
                    >
                      {row.defaultStatus.replace('_', ' ')}
                    </span>
                  </div>
                  {row.matches.length > 0 && (
                    <div className="text-xs text-slate-600">
                      Top match:{' '}
                      <strong>{row.matches[0]!.displayName}</strong>{' '}
                      <span className="text-slate-500">
                        ({row.matches[0]!.confidence}, score {row.matches[0]!.score})
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      onClick={() =>
                        setDecision(row.rowIndex, {
                          rowIndex: row.rowIndex,
                          decision: 'merge',
                          mergeIntoId: matchId,
                        })
                      }
                      disabled={!matchId}
                      className={`btn-secondary ${decision === 'merge' ? 'ring-2 ring-brand-500' : ''}`}
                    >
                      Merge
                    </button>
                    <button
                      onClick={() => setDecision(row.rowIndex, { rowIndex: row.rowIndex, decision: 'create' })}
                      className={`btn-secondary ${decision === 'create' ? 'ring-2 ring-brand-500' : ''}`}
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setDecision(row.rowIndex, { rowIndex: row.rowIndex, decision: 'skip' })}
                      className={`btn-secondary ${decision === 'skip' ? 'ring-2 ring-brand-500' : ''}`}
                    >
                      Skip
                    </button>
                  </div>
                  {row.matches.length > 1 && row.defaultStatus !== 'create' && (
                    <details className="text-xs">
                      <summary>Other matches ({row.matches.length - 1})</summary>
                      <ul className="mt-1 space-y-1">
                        {row.matches.slice(1).map((m) => (
                          <li key={m.contactId}>
                            <button
                              className="text-brand-600 hover:underline"
                              onClick={() =>
                                setDecision(row.rowIndex, {
                                  rowIndex: row.rowIndex,
                                  decision: 'merge',
                                  mergeIntoId: m.contactId,
                                })
                              }
                            >
                              Merge into {m.displayName} ({m.confidence})
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-20 z-10 flex gap-2 pb-2">
            <button onClick={() => setStage('mapping')} className="btn-secondary flex-1" disabled={pending}>
              ← Map
            </button>
            <button onClick={onCommit} className="btn-primary flex-1" disabled={pending}>
              {pending ? 'Committing…' : 'Commit import'}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="card space-y-2">
          <h2 className="text-base font-semibold">Import done</h2>
          <p className="text-sm">
            Created <strong>{result.created}</strong>, merged <strong>{result.merged}</strong>, skipped{' '}
            <strong>{result.skipped}</strong>.
          </p>
          <a className="btn-primary inline-block" href="/contacts">
            View contacts
          </a>
        </div>
      )}
    </div>
  );
}
