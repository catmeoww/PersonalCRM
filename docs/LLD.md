# PersonalCRM — Low-Level Engineering Design

## 1. Repository Layout

```
PersonalCRM/
├─ app/                         # Next.js App Router
│  ├─ layout.tsx                # Shell: bottom tab bar
│  ├─ page.tsx                  # Redirect → /contacts
│  ├─ contacts/
│  │  ├─ page.tsx               # List + search + tag filter
│  │  ├─ new/page.tsx           # Create form
│  │  └─ [id]/
│  │     ├─ page.tsx            # Detail + notes timeline
│  │     └─ edit/page.tsx       # Edit form
│  ├─ voice/page.tsx            # Voice capture
│  ├─ holiday/page.tsx          # Holiday card table
│  ├─ tags/page.tsx             # Tag manager
│  └─ api/
│     ├─ contacts/route.ts
│     ├─ contacts/[id]/route.ts
│     ├─ notes/route.ts
│     ├─ tags/route.ts
│     ├─ holiday/route.ts
│     └─ voice/match/route.ts
├─ lib/
│  ├─ db/
│  │  ├─ client.ts              # better-sqlite3 singleton
│  │  ├─ schema.ts              # Drizzle schema
│  │  └─ migrations/            # generated SQL
│  ├─ repositories/
│  │  ├─ contacts.ts
│  │  ├─ kids.ts
│  │  ├─ handles.ts
│  │  ├─ tags.ts
│  │  ├─ notes.ts
│  │  └─ holiday.ts
│  ├─ services/
│  │  ├─ contacts.ts            # orchestrates multi-table ops
│  │  ├─ voice-match.ts         # fuzzy match
│  │  └─ holiday.ts             # copy-from-year etc.
│  ├─ validation/               # zod schemas
│  └─ utils/
├─ components/                  # shared UI (forms, chips, toasts)
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/
├─ drizzle.config.ts
├─ tests/
│  ├─ unit/
│  └─ e2e/
├─ docs/
└─ package.json
```

## 2. Tech Versions

- Node 20 LTS
- Next.js 15.x (App Router, Server Actions enabled)
- TypeScript 5.5+ (`strict: true`, `noUncheckedIndexedAccess: true`)
- Drizzle ORM 0.33+, `better-sqlite3` 11.x
- Tailwind 3.x, shadcn/ui
- Vitest 2.x, Playwright 1.4x
- Fuse.js 7.x

## 3. Database Schema (Drizzle)

### 3.1 Tables

```ts
// lib/db/schema.ts
import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  nicknamesJson: text('nicknames_json').notNull().default('[]'), // JSON string[]
  workCompany: text('work_company'),
  workTitle: text('work_title'),
  workTeam: text('work_team'),
  bio: text('bio'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull().default(sql`(unixepoch() * 1000)`),
});

export const kids = sqliteTable('kids', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  grade: text('grade'),          // "K", "1", "2", ... stored as text for flexibility
  school: text('school'),
  sportsJson: text('sports_json').notNull().default('[]'),
  interests: text('interests'),
});

export const messagingHandles = sqliteTable('messaging_handles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(), // 'whatsapp' | 'wechat' | 'imessage' | 'sms' | 'email' | 'other'
  handle: text('handle').notNull(),
  displayName: text('display_name'),
}, t => ({
  uq: unique('handles_unique').on(t.contactId, t.platform, t.handle),
}));

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  category: text('category').notNull(), // 'work' | 'parents' | 'social' | 'family' | 'custom'
  color: text('color'),
});

export const contactTags = sqliteTable('contact_tags', {
  contactId: integer('contact_id').notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, t => ({
  pk: unique('contact_tags_pk').on(t.contactId, t.tagId),
}));

export const noteEntries = sqliteTable('note_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  source: text('source').notNull().default('typed'), // 'typed' | 'voice'
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull().default(sql`(unixepoch() * 1000)`),
});

export const holidayCards = sqliteTable('holiday_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  sent: integer('sent', { mode: 'boolean' }).notNull().default(false),
  channel: text('channel'), // 'physical' | 'ecard' | 'digital'
  notes: text('notes'),
}, t => ({
  uq: unique('holiday_year_unique').on(t.contactId, t.year),
}));

export const searchIndex = sqliteTable('search_index', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id').notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'name' | 'nickname' | 'kid' | 'handle'
  token: text('token').notNull(),
});
```

### 3.2 Indexes

```sql
CREATE INDEX idx_kids_contact ON kids(contact_id);
CREATE INDEX idx_handles_contact ON messaging_handles(contact_id);
CREATE INDEX idx_notes_contact_created ON note_entries(contact_id, created_at DESC);
CREATE INDEX idx_holiday_year ON holiday_cards(year);
CREATE INDEX idx_search_token ON search_index(token);
CREATE INDEX idx_search_contact ON search_index(contact_id);
CREATE INDEX idx_contact_tags_tag ON contact_tags(tag_id);
```

### 3.3 Triggers (search index maintenance)

Kept simple: the repository layer writes `search_index` rows explicitly in the same transaction as contact/kid/handle mutations, rather than DB triggers, to keep logic testable.

### 3.4 PRAGMAs on connection

```
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

## 4. Validation Schemas (zod)

```ts
// lib/validation/contacts.ts
export const HandleSchema = z.object({
  platform: z.enum(['whatsapp','wechat','imessage','sms','email','other']),
  handle: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
});

export const KidSchema = z.object({
  name: z.string().min(1).max(100),
  grade: z.string().max(10).optional(),
  school: z.string().max(200).optional(),
  sports: z.array(z.string().max(50)).default([]),
  interests: z.string().max(500).optional(),
});

export const ContactCreateSchema = z.object({
  displayName: z.string().min(1).max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  nicknames: z.array(z.string().max(100)).default([]),
  workCompany: z.string().max(200).optional(),
  workTitle: z.string().max(200).optional(),
  workTeam: z.string().max(200).optional(),
  bio: z.string().max(4000).optional(),
  kids: z.array(KidSchema).default([]),
  handles: z.array(HandleSchema).default([]),
  tagIds: z.array(z.number().int().positive()).default([]),
});
```

## 5. API Contracts

### 5.1 `POST /api/contacts`

Request body: `ContactCreateSchema`.

Response `201`:
```json
{ "id": 42 }
```

### 5.2 `GET /api/contacts?q=&tag=1,2&limit=50&cursor=100`

Response:
```json
{
  "items": [
    { "id": 42, "displayName": "Jenny Wang", "tagIds": [3,4], "kidCount": 1 }
  ],
  "nextCursor": 150
}
```

### 5.3 `GET /api/contacts/:id`

Returns full contact with nested `kids`, `handles`, `tags`, and last 50 notes.

### 5.4 `PATCH /api/contacts/:id`

Partial update. Same body shape as create with all fields optional.

### 5.5 `POST /api/notes`

```json
{ "contactId": 42, "body": "Going to Camp Galileo this summer", "source": "voice" }
```

Response: `{ "id": 101, "createdAt": 1713580000000 }`

### 5.6 `POST /api/voice/match`

```json
{ "transcript": "Lucas Wang is going to camp galileo" }
```

Response:
```json
{
  "candidates": [
    { "contactId": 42, "displayName": "Jenny Wang", "matchedOn": "kid:Lucas", "score": 0.12 },
    { "contactId": 77, "displayName": "Peter Wang", "matchedOn": "name:Wang", "score": 0.31 }
  ]
}
```

### 5.7 `POST /api/holiday/copy`

```json
{ "fromYear": 2025, "toYear": 2026 }
```

Response: `{ "copied": 87 }`

### 5.8 `PUT /api/holiday`

```json
{ "contactId": 42, "year": 2026, "sent": true, "channel": "physical" }
```

### 5.9 Error format

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "details": {...} } }
```

HTTP codes: 400 validation, 404 missing, 409 conflict (dup tag name), 500 unhandled.

## 6. Services

### 6.1 `ContactService.create(input)` (pseudocode)

```ts
db.transaction(() => {
  const { id } = db.insert(contacts).values({...}).returning({ id });
  for (const kid of input.kids)   db.insert(kids).values({ contactId: id, ... });
  for (const h of input.handles)  db.insert(messagingHandles).values({ contactId: id, ... });
  for (const tagId of input.tagIds) db.insert(contactTags).values({ contactId: id, tagId });
  rebuildSearchIndexFor(id, input);
  return id;
});
```

`rebuildSearchIndexFor`: deletes existing `search_index` rows for contactId, then inserts tokens from displayName, nicknames, each kid name, each handle (lowercased, normalized).

### 6.2 `VoiceMatchService.match(transcript)` (pseudocode)

```ts
// 1. Load all search_index rows joined to contacts (cached in-process with 60s TTL).
const rows = cache.get() ?? loadAll();

// 2. Normalize transcript: lowercase, strip punctuation.
const q = normalize(transcript);

// 3. Run Fuse over { token, contactId, kind } with weights:
//    name: 1.0, nickname: 0.9, kid: 0.8, handle: 0.5
const fuse = new Fuse(rows, {
  keys: ['token'],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 3,
});

// 4. Search with q and also each token of q (to catch "Lucas Wang").
const hits = [...fuse.search(q), ...q.split(/\s+/).flatMap(t => fuse.search(t))];

// 5. Aggregate per contactId: keep best score * kind weight.
// 6. Return top 3.
```

Cache invalidation: on any write to contacts/kids/handles, bump a `searchIndexVersion` integer; voice-match compares and reloads.

### 6.3 `HolidayService.copyYear({ fromYear, toYear })`

```sql
INSERT OR IGNORE INTO holiday_cards (contact_id, year, sent, channel)
SELECT contact_id, :toYear, 0, channel FROM holiday_cards WHERE year = :fromYear AND sent = 1;
```

`sent` is initialized to `0` (pending); user toggles as they send.

## 7. Frontend Details

### 7.1 Bottom tab bar

- Four items: Contacts, Voice, Holiday, Tags.
- Active state from `usePathname()`.
- Safe-area inset padding for iOS.

### 7.2 Contacts list

- Server Component reads page data.
- Client component renders the list with virtualization (`@tanstack/react-virtual`) when > 200 rows.
- Search box is controlled via URL param `?q=`; debounced 250ms (client-side).
- Tag chips selectable; selection syncs to `?tag=` param.

### 7.3 Contact form (create/edit)

Sections:
1. **Basics**: name, nicknames (chip input), work fields.
2. **Kids**: repeater — add/remove rows, each with name/grade/school/sports chips/interests.
3. **Messaging**: repeater — platform select + handle + display name.
4. **Tags**: combobox that creates on Enter if no match.
5. **Notes (first note)**: single textarea; saved as first `note_entries` row.
6. Sticky footer with **Save** button.

Submission uses a Server Action `saveContact(formData)` which parses, calls `ContactService.create/update`, and `redirect()`s to the detail page.

### 7.4 Voice page

```tsx
// Pseudocode
const rec = new (window.SpeechRecognition ?? window.webkitSpeechRecognition)();
rec.lang = 'en-US';
rec.interimResults = true;

function start() {
  setTranscript('');
  rec.onresult = e => setTranscript(collectText(e.results));
  rec.onend = () => finalize();
  rec.start();
}

async function finalize() {
  const res = await fetch('/api/voice/match', {
    method: 'POST', body: JSON.stringify({ transcript })
  });
  setCandidates((await res.json()).candidates);
}

function confirm(contactId) {
  return fetch('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ contactId, body: transcript, source: 'voice' }),
  });
}
```

UI states: idle → listening → transcript (editable) → candidates → saved.

### 7.5 Holiday page

- Year selector (defaults to current year).
- Table columns: Contact | Tags | Sent last year | Sent this year (toggle) | Channel | Notes.
- "Copy last year" button calls `/api/holiday/copy`.
- Filter by tag chips (same component as Contacts list).
- Export button → `/api/holiday/export.csv?year=2026`.

### 7.6 Tags page

- Simple list grouped by category.
- Create inline.
- Drag to reorder not needed V1.
- Renaming cascades via FK; no data fix needed.

## 8. Server Actions vs API Routes

- **Server Actions** used for mutations triggered from forms (createContact, updateContact, appendNote, toggleHoliday).
- **API routes** used where the voice page (a client component) needs JSON endpoints (voice/match) and for CSV export.

## 9. Testing Plan

### 9.1 Unit (vitest)
- `voice-match.test.ts`: seed fixture (Jenny/Lucas, Peter Wang, etc.), assert:
  - "Lucas Wang …" → top candidate is Jenny (kid match).
  - "Peter Wong" → Peter Wang within threshold.
  - Gibberish → empty candidates.
- `contact-service.test.ts`: create → readback includes kids/handles/tags; update replaces tags correctly; delete cascades kids/handles/notes.
- `holiday-service.test.ts`: copy year pre-seeds correct rows; idempotent on re-run.

### 9.2 Integration
- API route tests with a temp SQLite file per test.

### 9.3 E2E (playwright)
- One test per CUJ running against `pnpm dev`.
- CUJ 2 e2e stubs `webkitSpeechRecognition` via a page init script.

### 9.4 CI
- GitHub Actions: lint → typecheck → unit → e2e headless.

## 10. Observability

- `pino` logs every request with method, path, duration, status.
- `request_id` header echoed in error responses.
- Simple `/api/health` returns `{ ok: true, dbMs: <ping> }`.

## 11. Migration Rollout

Migrations applied at server boot via `drizzle-orm/better-sqlite3/migrator`. Version tracked in `__drizzle_migrations` table. Backward-compatible changes only; destructive migrations require a manual `pnpm db:backup` step.

## 12. Build / Run

```
pnpm install
pnpm db:migrate
pnpm dev          # http://localhost:3000
pnpm build && pnpm start
pnpm test         # unit + integration
pnpm test:e2e
```

## 13. Out-of-scope (pointers for V1.1 / V2)

- **Offline write queue**: IndexedDB outbox + replay on reconnect.
- **Whisper fallback**: `/api/voice/transcribe` accepting `multipart/form-data` audio; gated by `VOICE_PROVIDER=whisper`.
- **Reminders**: new `reminders` table with `contactId`, `dueAt`, `message`; server cron (node-cron) posts web-push notifications.
- **Sync**: Turso / libSQL replica, or Supabase Postgres with Drizzle's Postgres adapter — schema is portable.
- **LLM enrichment**: on note save, extract structured facts (school, camp, sport) into a `facts` table.

## 14. Open Implementation Questions

- iOS PWA + `webkitSpeechRecognition`: needs a physical-device test pass before we commit to browser STT.
- Do we enforce uniqueness on `contacts.displayName`? Current design: no, but surface a "Possible duplicate?" warning on create if name collides.
- Time zone: store timestamps as UTC epoch ms; render in the user's locale. Holiday year uses user-local year at creation time.
