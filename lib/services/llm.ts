import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export type ExtractedContact = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  nicknames: string[];
  workCompany?: string;
  workTitle?: string;
  workTeam?: string;
  bio?: string;
  phone?: string;
  email?: string;
  kids: Array<{
    name: string;
    grade?: string;
    school?: string;
    sports: string[];
    interests?: string;
  }>;
  handles: Array<{ platform: string; handle: string }>;
  tags: string[];
  summary?: string;
};

const PROMPT = `You extract contact info from freeform text into JSON.

Rules:
- Output ONLY a JSON object. No prose, no markdown fences.
- Only include fields clearly stated in the text. Omit unknown fields rather than guessing.
- Fields you may use:
  displayName, firstName, lastName, nicknames (array), workCompany, workTitle, workTeam, bio,
  phone, email, kids (array of {name, grade, school, sports[], interests}),
  handles (array of {platform in ["whatsapp","wechat","imessage","sms","email","other"], handle}),
  tags (array), summary (one-sentence recap of remaining context).
- Grade: store as digit string "K", "1"..."12". Skip if unsure.
- Tags: only obvious life-circle labels (e.g. "Pinewood Parents", "Work"). Do not invent.

Text to extract from:
"""
%TEXT%
"""`;

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function emptyResult(): ExtractedContact {
  return { nicknames: [], kids: [], handles: [], tags: [] };
}

function coerce(parsed: unknown): ExtractedContact {
  const out = emptyResult();
  if (!parsed || typeof parsed !== 'object') return out;
  const o = parsed as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : undefined);
  const arrStr = (k: string): string[] =>
    Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  out.displayName = str('displayName');
  out.firstName = str('firstName');
  out.lastName = str('lastName');
  out.nicknames = arrStr('nicknames');
  out.workCompany = str('workCompany');
  out.workTitle = str('workTitle');
  out.workTeam = str('workTeam');
  out.bio = str('bio');
  out.phone = str('phone');
  out.email = str('email');
  out.summary = str('summary');
  out.tags = arrStr('tags');

  if (Array.isArray(o.kids)) {
    for (const k of o.kids as unknown[]) {
      if (!k || typeof k !== 'object') continue;
      const kid = k as Record<string, unknown>;
      const name = typeof kid.name === 'string' ? kid.name.trim() : '';
      if (!name) continue;
      out.kids.push({
        name,
        grade: typeof kid.grade === 'string' ? kid.grade : undefined,
        school: typeof kid.school === 'string' ? kid.school : undefined,
        sports: Array.isArray(kid.sports)
          ? (kid.sports as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
        interests: typeof kid.interests === 'string' ? kid.interests : undefined,
      });
    }
  }

  if (Array.isArray(o.handles)) {
    for (const h of o.handles as unknown[]) {
      if (!h || typeof h !== 'object') continue;
      const handle = h as Record<string, unknown>;
      if (typeof handle.platform !== 'string' || typeof handle.handle !== 'string') continue;
      out.handles.push({ platform: handle.platform, handle: handle.handle.trim() });
    }
  }

  return out;
}

export async function extractFromText(text: string): Promise<{
  extracted: ExtractedContact;
  source: 'llm' | 'fallback';
  error?: string;
}> {
  const clean = text.trim();
  if (!clean) return { extracted: emptyResult(), source: 'fallback' };
  try {
    const { stdout } = await exec(
      'claude',
      [
        '-p',
        PROMPT.replace('%TEXT%', clean.slice(0, 4000)),
        '--output-format',
        'text',
        '--disallowed-tools',
        '*',
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    const cleaned = stripFences(stdout);
    const parsed = JSON.parse(cleaned);
    return { extracted: coerce(parsed), source: 'llm' };
  } catch (err) {
    return {
      extracted: heuristicExtract(clean),
      source: 'fallback',
      error: (err as Error).message,
    };
  }
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

function heuristicExtract(text: string): ExtractedContact {
  const out = emptyResult();
  const email = text.match(EMAIL_RE)?.[0];
  const phone = text.match(PHONE_RE)?.[0]?.replace(/\D+/g, '');
  if (email) out.email = email;
  if (phone) out.phone = phone;
  out.summary = text;
  const lead = text.split(/[,.\n]/, 1)[0]?.trim();
  if (lead && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/.test(lead)) {
    const m = lead.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/);
    if (m) out.displayName = m[0];
  }
  return out;
}

export { heuristicExtract };
