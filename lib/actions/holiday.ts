'use server';

import { revalidatePath } from 'next/cache';
import { HolidayCopySchema, HolidayUpsertSchema } from '@/lib/validation/contacts';
import { copyHolidayYear, upsertHoliday } from '@/lib/services/holiday';

export async function toggleHolidayAction(input: {
  contactId: number;
  year: number;
  sent: boolean;
  channel?: string | null;
  notes?: string | null;
}) {
  const parsed = HolidayUpsertSchema.parse(input);
  upsertHoliday(parsed);
  revalidatePath('/holiday');
}

export async function copyHolidayYearAction(input: { fromYear: number; toYear: number }) {
  const parsed = HolidayCopySchema.parse(input);
  const copied = copyHolidayYear(parsed.fromYear, parsed.toYear);
  revalidatePath('/holiday');
  return { copied };
}
