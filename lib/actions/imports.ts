'use server';

import { revalidatePath } from 'next/cache';
import {
  applyMapping,
  classifyRow,
  commitCreate,
  commitMerge,
  fetchSheetCsv,
  finishImportRun,
  guessHeaderMapping,
  hashRow,
  parseCsv,
  recordImportRow,
  rowMappedFromExtracted,
  startImportRun,
  type ImportField,
  type ReviewRow,
} from '@/lib/services/imports';
import { extractFromText } from '@/lib/services/llm';

export type PreviewResponse = {
  csvUrl: string;
  headers: string[];
  preview: string[][];
  rowCount: number;
  defaultMapping: ImportField[];
};

export async function previewSheetAction(formData: FormData): Promise<{ ok: true; data: PreviewResponse } | { ok: false; error: string }> {
  const sheetUrl = String(formData.get('sheetUrl') ?? '').trim();
  if (!sheetUrl) return { ok: false, error: 'Sheet URL is required.' };
  try {
    const { csv, csvUrl } = await fetchSheetCsv(sheetUrl);
    const rows = parseCsv(csv);
    if (rows.length === 0) return { ok: false, error: 'Sheet is empty.' };
    const headers = rows[0]!.map((h) => h.trim());
    const data = rows.slice(1);
    return {
      ok: true,
      data: {
        csvUrl,
        headers,
        preview: data.slice(0, 5),
        rowCount: data.length,
        defaultMapping: guessHeaderMapping(headers),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type DryRunResponse = {
  csvUrl: string;
  headers: string[];
  mapping: ImportField[];
  rows: ReviewRow[];
  counts: { autoMerge: number; review: number; create: number };
};

export async function dryRunSheetAction(formData: FormData): Promise<{ ok: true; data: DryRunResponse } | { ok: false; error: string }> {
  const sheetUrl = String(formData.get('sheetUrl') ?? '').trim();
  const mappingJson = String(formData.get('mapping') ?? '[]');
  let mapping: ImportField[];
  try {
    mapping = JSON.parse(mappingJson) as ImportField[];
  } catch {
    return { ok: false, error: 'Invalid column mapping.' };
  }
  try {
    const { csv, csvUrl } = await fetchSheetCsv(sheetUrl);
    const rows = parseCsv(csv);
    const headers = rows[0]!.map((h) => h.trim());
    const dataRows = rows.slice(1);
    const reviewRows: ReviewRow[] = [];
    const counts = { autoMerge: 0, review: 0, create: 0 };
    for (let i = 0; i < dataRows.length; i++) {
      const values = dataRows[i]!;
      const mapped = applyMapping(values, mapping, headers);
      const { matches, status, defaultMatchId } = classifyRow(mapped);
      reviewRows.push({
        rowIndex: i,
        rowHash: hashRow(values),
        raw: values,
        mapped,
        matches,
        defaultStatus: status,
        defaultMatchId,
      });
      if (status === 'auto_merge') counts.autoMerge += 1;
      else if (status === 'review') counts.review += 1;
      else counts.create += 1;
    }
    return { ok: true, data: { csvUrl, headers, mapping, rows: reviewRows, counts } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type CommitDecision = { rowIndex: number; decision: 'merge' | 'create' | 'skip'; mergeIntoId?: number };

export async function commitSheetAction(input: {
  sourceUrl: string;
  mapping: ImportField[];
  rows: ReviewRow[];
  decisions: CommitDecision[];
}): Promise<{ ok: true; created: number; merged: number; skipped: number } | { ok: false; error: string }> {
  try {
    const runId = startImportRun({
      sourceType: 'sheet',
      sourceUrl: input.sourceUrl,
      columnMap: input.mapping,
      rowsTotal: input.rows.length,
    });
    let created = 0,
      merged = 0,
      skipped = 0;
    const decisionsByIndex = new Map(input.decisions.map((d) => [d.rowIndex, d]));
    for (const row of input.rows) {
      const decision =
        decisionsByIndex.get(row.rowIndex) ??
        ({ rowIndex: row.rowIndex, decision: row.defaultStatus === 'auto_merge' ? 'merge' : row.defaultStatus === 'create' ? 'create' : 'skip', mergeIntoId: row.defaultMatchId } as CommitDecision);
      const sourceNote = `Imported from sheet on ${new Date().toISOString().slice(0, 10)} (row ${row.rowIndex + 1}).`;
      let matchedId: number | null = null;
      let statusOut = 'skipped';
      try {
        if (decision.decision === 'merge' && decision.mergeIntoId) {
          commitMerge(decision.mergeIntoId, row.mapped, sourceNote);
          merged += 1;
          matchedId = decision.mergeIntoId;
          statusOut = 'merged';
        } else if (decision.decision === 'create') {
          const id = commitCreate(row.mapped, sourceNote);
          created += 1;
          matchedId = id;
          statusOut = 'created';
        } else {
          skipped += 1;
        }
      } catch (err) {
        skipped += 1;
        statusOut = `error:${(err as Error).message}`;
      }
      recordImportRow({
        importRunId: runId,
        rowIndex: row.rowIndex,
        rowHash: row.rowHash,
        raw: row.raw,
        parsed: row.mapped,
        matchedContactId: matchedId,
        status: statusOut,
        decision: decision.decision,
      });
    }
    finishImportRun(runId, { created, merged, skipped });
    revalidatePath('/contacts');
    return { ok: true, created, merged, skipped };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type TextExtractResponse = {
  source: 'llm' | 'fallback';
  warning?: string;
  mapped: ReviewRow['mapped'];
  matches: ReviewRow['matches'];
  defaultStatus: ReviewRow['defaultStatus'];
  defaultMatchId?: number;
  originalText: string;
};

export async function extractTextAction(formData: FormData): Promise<{ ok: true; data: TextExtractResponse } | { ok: false; error: string }> {
  const text = String(formData.get('text') ?? '').trim();
  if (!text) return { ok: false, error: 'Paste some text first.' };
  try {
    const { extracted, source, error } = await extractFromText(text);
    const mapped = rowMappedFromExtracted(extracted);
    if (!mapped.displayName) mapped.displayName = '';
    if (text && !mapped.notes.some((n) => n === text)) mapped.notes.push(text);
    const { matches, status, defaultMatchId } = classifyRow(mapped);
    return {
      ok: true,
      data: {
        source,
        warning: error,
        mapped,
        matches,
        defaultStatus: status,
        defaultMatchId,
        originalText: text,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function commitTextAction(input: {
  decision: 'merge' | 'create' | 'skip';
  mergeIntoId?: number;
  mapped: ReviewRow['mapped'];
  originalText: string;
}): Promise<{ ok: true; contactId?: number } | { ok: false; error: string }> {
  try {
    const runId = startImportRun({
      sourceType: 'text',
      sourceLabel: input.originalText.slice(0, 80),
      rowsTotal: 1,
    });
    const sourceNote = `Imported from freeform text on ${new Date().toISOString().slice(0, 10)}.`;
    let created = 0,
      merged = 0,
      skipped = 0;
    let contactId: number | undefined;
    if (input.decision === 'merge' && input.mergeIntoId) {
      commitMerge(input.mergeIntoId, input.mapped, sourceNote);
      merged = 1;
      contactId = input.mergeIntoId;
    } else if (input.decision === 'create') {
      contactId = commitCreate(input.mapped, sourceNote);
      created = 1;
    } else {
      skipped = 1;
    }
    recordImportRow({
      importRunId: runId,
      rowIndex: 0,
      rowHash: hashRow([input.originalText]),
      raw: input.originalText,
      parsed: input.mapped,
      matchedContactId: contactId ?? null,
      status: input.decision,
      decision: input.decision,
    });
    finishImportRun(runId, { created, merged, skipped });
    revalidatePath('/contacts');
    if (contactId) revalidatePath(`/contacts/${contactId}`);
    return { ok: true, contactId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
