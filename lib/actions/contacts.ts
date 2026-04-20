'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  appendNote,
  createContact,
  deleteContact,
  updateContact,
} from '@/lib/services/contacts';
import { findOrCreateTagByName } from '@/lib/services/tags';
import {
  ContactCreateSchema,
  ContactUpdateSchema,
  KidSchema,
  HandleSchema,
  NoteCreateSchema,
  type ContactCreateInput,
  type KidInput,
  type HandleInput,
} from '@/lib/validation/contacts';
import { TAG_CATEGORIES } from '@/lib/db/schema';

function parseList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseKids(formData: FormData): KidInput[] {
  const kids: KidInput[] = [];
  const names = formData.getAll('kid_name[]').map(String);
  const grades = formData.getAll('kid_grade[]').map(String);
  const schools = formData.getAll('kid_school[]').map(String);
  const sports = formData.getAll('kid_sports[]').map(String);
  const interests = formData.getAll('kid_interests[]').map(String);
  for (let i = 0; i < names.length; i++) {
    const name = names[i]?.trim();
    if (!name) continue;
    kids.push(
      KidSchema.parse({
        name,
        grade: grades[i] ?? '',
        school: schools[i] ?? '',
        sports: parseList(sports[i]),
        interests: interests[i] ?? '',
      }),
    );
  }
  return kids;
}

function parseHandles(formData: FormData): HandleInput[] {
  const handles: HandleInput[] = [];
  const platforms = formData.getAll('handle_platform[]').map(String);
  const values = formData.getAll('handle_value[]').map(String);
  const names = formData.getAll('handle_name[]').map(String);
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const handle = values[i]?.trim();
    if (!handle || !platform) continue;
    handles.push(HandleSchema.parse({ platform, handle, displayName: names[i] ?? '' }));
  }
  return handles;
}

async function parseTagIds(formData: FormData): Promise<number[]> {
  const existing = formData
    .getAll('tag_id[]')
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const newNamesRaw = String(formData.get('new_tags') ?? '');
  const newNames = parseList(newNamesRaw);
  for (const name of newNames) {
    const t = findOrCreateTagByName(name, 'custom');
    existing.push(t.id);
  }
  return [...new Set(existing)];
}

export async function createContactAction(formData: FormData) {
  const tagIds = await parseTagIds(formData);
  const input: ContactCreateInput = ContactCreateSchema.parse({
    displayName: String(formData.get('displayName') ?? ''),
    nicknames: parseList(String(formData.get('nicknames') ?? '')),
    workCompany: String(formData.get('workCompany') ?? ''),
    workTitle: String(formData.get('workTitle') ?? ''),
    workTeam: String(formData.get('workTeam') ?? ''),
    bio: String(formData.get('bio') ?? ''),
    kids: parseKids(formData),
    handles: parseHandles(formData),
    tagIds,
    firstNote: String(formData.get('firstNote') ?? ''),
  });
  const id = createContact(input);
  revalidatePath('/contacts');
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(id: number, formData: FormData) {
  const tagIds = await parseTagIds(formData);
  const input = ContactUpdateSchema.parse({
    displayName: String(formData.get('displayName') ?? ''),
    nicknames: parseList(String(formData.get('nicknames') ?? '')),
    workCompany: String(formData.get('workCompany') ?? ''),
    workTitle: String(formData.get('workTitle') ?? ''),
    workTeam: String(formData.get('workTeam') ?? ''),
    bio: String(formData.get('bio') ?? ''),
    kids: parseKids(formData),
    handles: parseHandles(formData),
    tagIds,
  });
  updateContact(id, input);
  revalidatePath('/contacts');
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(id: number) {
  deleteContact(id);
  revalidatePath('/contacts');
  redirect('/contacts');
}

export async function appendNoteAction(formData: FormData) {
  const input = NoteCreateSchema.parse({
    contactId: Number(formData.get('contactId')),
    body: String(formData.get('body') ?? ''),
    source: (formData.get('source') as string) || 'typed',
  });
  const r = appendNote(input.contactId, input.body, input.source);
  revalidatePath(`/contacts/${input.contactId}`);
  return r;
}
