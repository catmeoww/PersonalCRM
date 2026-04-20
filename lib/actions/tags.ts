'use server';

import { revalidatePath } from 'next/cache';
import { TagCreateSchema } from '@/lib/validation/contacts';
import { createTag, deleteTag, updateTag } from '@/lib/services/tags';
import type { TagCategory } from '@/lib/db/schema';

export async function createTagAction(formData: FormData) {
  const input = TagCreateSchema.parse({
    name: String(formData.get('name') ?? ''),
    category: String(formData.get('category') ?? 'custom'),
    color: String(formData.get('color') ?? '') || null,
  });
  createTag(input);
  revalidatePath('/tags');
  revalidatePath('/contacts');
}

export async function updateTagAction(id: number, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() as TagCategory;
  const color = String(formData.get('color') ?? '').trim() || null;
  updateTag(id, { name: name || undefined, category: category || undefined, color });
  revalidatePath('/tags');
}

export async function deleteTagAction(id: number) {
  deleteTag(id);
  revalidatePath('/tags');
  revalidatePath('/contacts');
}
