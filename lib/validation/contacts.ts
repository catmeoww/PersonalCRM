import { z } from 'zod';
import { HOLIDAY_CHANNELS, NOTE_SOURCES, PLATFORMS, TAG_CATEGORIES } from '@/lib/db/schema';

export const HandleSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(200),
  displayName: z.string().max(200).optional().nullable(),
});

export const KidSchema = z.object({
  name: z.string().min(1).max(100),
  grade: z.string().max(10).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  sports: z.array(z.string().max(50)).default([]),
  interests: z.string().max(500).optional().nullable(),
});

const blankToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const ContactCreateSchema = z.object({
  displayName: z.string().min(1).max(200),
  firstName: z.preprocess(blankToUndef, z.string().max(100).optional()),
  lastName: z.preprocess(blankToUndef, z.string().max(100).optional()),
  nicknames: z.array(z.string().max(100)).default([]),
  workCompany: z.preprocess(blankToUndef, z.string().max(200).optional()),
  workTitle: z.preprocess(blankToUndef, z.string().max(200).optional()),
  workTeam: z.preprocess(blankToUndef, z.string().max(200).optional()),
  bio: z.preprocess(blankToUndef, z.string().max(4000).optional()),
  kids: z.array(KidSchema).default([]),
  handles: z.array(HandleSchema).default([]),
  tagIds: z.array(z.number().int().positive()).default([]),
  firstNote: z.preprocess(blankToUndef, z.string().max(4000).optional()),
});

export const ContactUpdateSchema = ContactCreateSchema.partial().extend({
  displayName: z.string().min(1).max(200).optional(),
});

export const NoteCreateSchema = z.object({
  contactId: z.number().int().positive(),
  body: z.string().min(1).max(4000),
  source: z.enum(NOTE_SOURCES).default('typed'),
});

export const TagCreateSchema = z.object({
  name: z.string().min(1).max(60),
  category: z.enum(TAG_CATEGORIES),
  color: z.string().max(20).optional().nullable(),
});

export const HolidayUpsertSchema = z.object({
  contactId: z.number().int().positive(),
  year: z.number().int().min(1970).max(3000),
  sent: z.boolean(),
  channel: z.enum(HOLIDAY_CHANNELS).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const HolidayCopySchema = z.object({
  fromYear: z.number().int().min(1970).max(3000),
  toYear: z.number().int().min(1970).max(3000),
});

export const VoiceMatchSchema = z.object({
  transcript: z.string().min(1).max(1000),
});

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
export type KidInput = z.infer<typeof KidSchema>;
export type HandleInput = z.infer<typeof HandleSchema>;
