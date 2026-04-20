# PersonalCRM — High-Level Engineering Design

## 1. System Overview

PersonalCRM is a single-user, mobile-first web application served as an installable PWA. The backend and frontend are co-located in a Next.js (App Router) project. Persistence is a local SQLite database accessed through `better-sqlite3`. Voice input is captured with the browser's Web Speech API (primary) with a server-side Whisper fallback (V1.1).

```
┌──────────────────────────────────────────────────┐
│                     Browser                      │
│  ┌────────────────────────────────────────────┐  │
│  │ Next.js Client (React Server Components +  │  │
│  │ Client Components)                         │  │
│  │  - Contacts UI, Voice UI, Holiday UI       │  │
│  │  - Service Worker (PWA offline shell)      │  │
│  │  - Web Speech API (webkitSpeechRecognition)│  │
│  └────────────┬───────────────────────────────┘  │
│               │ fetch() / Server Actions         │
└───────────────┼──────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────┐
│                 Next.js Server                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Route handlers / Server Actions            │  │
│  │  - /api/contacts, /api/notes, /api/holiday │  │
│  │  - /api/voice/match (fuzzy matcher)        │  │
│  └────────────┬───────────────────────────────┘  │
│               │                                  │
│  ┌────────────▼───────────────┐  ┌────────────┐  │
│  │ Repositories (data access) │→ │ SQLite DB  │  │
│  │  contacts, kids, handles,  │  │ (file on   │  │
│  │  tags, notes, holiday      │  │ disk)      │  │
│  └────────────────────────────┘  └────────────┘  │
└──────────────────────────────────────────────────┘
```

## 2. Architectural Decisions

| Decision | Choice | Rationale | Alternatives considered |
|----------|--------|-----------|-------------------------|
| Framework | Next.js 15 (App Router) | Single codebase for client + server; Server Actions simplify API; great PWA support. | Remix, Expo/React Native. RN rejected for V1 because web PWA hits phone + desktop with one build. |
| Language | TypeScript (strict) | Type safety across client/server boundary. | Plain JS — rejected. |
| Persistence | SQLite via `better-sqlite3` | Zero-ops, single-file, synchronous API fits server actions. Trivial backup (copy file). | Postgres (overkill for single user), IndexedDB (harder to query/join). |
| Migrations | `drizzle-kit` + Drizzle ORM | Typed schema, generated migrations, simple syntax. | Prisma (heavier), raw SQL (no typing). |
| Styling | Tailwind CSS + shadcn/ui primitives | Fast to build mobile-first; accessible primitives. | CSS Modules. |
| State (client) | React state + URL search params; TanStack Query for server cache. | Avoids Redux overhead. URL params make tag filters shareable/back-button-safe. | Zustand — not needed at this scale. |
| Voice capture | Web Speech API (`webkitSpeechRecognition`) | On-device, free, fast. | Server Whisper — adds latency + cost; keep as V1.1 fallback. |
| Fuzzy matching | `fuse.js` on the server over a materialized "search index" table | Small library, good tolerance for partial/misheard names. | Postgres trigram (n/a on SQLite), FTS5 + custom ranking (more work). |
| PWA | `next-pwa` (or manual Workbox) | Well-supported, handles manifest + SW. | Bare-bones SW — more manual work. |
| Auth | None in V1 (single-user, local). Locked behind app-level PIN in V1.1. | Matches scope. | OAuth — out of scope. |

## 3. Component Breakdown

### 3.1 Frontend
- **Shell**: App Router layout with a bottom tab bar (Contacts, Voice, Holiday, Tags).
- **Contacts module**:
  - `ContactsListPage` (RSC): lists contacts, supports search + tag filter.
  - `ContactDetailPage` (RSC with a client island for the notes composer).
  - `ContactForm` (client): create/edit form for contact, kids, handles, tags.
- **Voice module**:
  - `VoicePage` (client): mic button, transcript preview, candidate list, confirm UI.
- **Holiday module**:
  - `HolidayPage` (RSC): year-over-year table; client islands for per-row toggles.
- **Tags module**:
  - `TagsPage` (RSC): CRUD list, reassign/rename.

### 3.2 Backend (route handlers + Server Actions)
- **Contacts service**: CRUD, list+filter, search.
- **Kids service**: CRUD scoped under a contact.
- **Handles service**: CRUD scoped under a contact.
- **Tags service**: CRUD, many-to-many attach/detach.
- **Notes service**: append-only write, paginated read by contact.
- **Holiday service**: per-year sent state, copy-from-year.
- **Voice match service**: given a transcript, returns ranked candidate contacts.

### 3.3 Data layer
- **Repositories** per entity; thin wrappers over Drizzle queries.
- **Migrations** live in `drizzle/migrations/*.sql`.
- **Seed script** for local development.

### 3.4 Cross-cutting
- **Validation**: `zod` schemas at the API boundary.
- **Error handling**: central `AppError` class; route handlers map to HTTP codes.
- **Logging**: `pino` with pretty output in dev.
- **Testing**: `vitest` for unit (services, matcher), `playwright` for one happy-path e2e per CUJ.

## 4. Data Model (ERD)

```
contacts ──┬── kids           (1..N)
           ├── messaging_handles (1..N)
           ├── contact_tags ── tags   (N..M)
           ├── note_entries   (1..N, append-only)
           └── holiday_cards  (1..N by year)
```

See LLD §3 for column-level schema.

## 5. Key Flows (Sequence Sketches)

### 5.1 CUJ 1 — Create contact
1. Client `ContactForm.submit()` → Server Action `createContact({contact, kids, handles, tagIds})`.
2. Server opens transaction → insert contact → insert kids → insert handles → insert contact_tags.
3. Server returns new `contact.id` → client router navigates to `/contacts/[id]`.

### 5.2 CUJ 2 — Voice update
1. Client starts `webkitSpeechRecognition`. On `result`, gets `transcript`.
2. Client POSTs `/api/voice/match` with `{transcript}`.
3. Server builds search tokens (name, kids' names, nicknames) via a `search_index` view; runs Fuse.js over in-memory index; returns top 3 with scores.
4. User picks one → Server Action `appendNote({contactId, body, source:'voice'})`.
5. Note is inserted; client invalidates contact cache.

### 5.3 CUJ 3 — Holiday list
1. `HolidayPage` loads → server reads `holiday_cards` for `(current_year, current_year - 1)`, joined with `contacts`.
2. "Copy from last year" → Server Action `copyHolidayYear({from, to})` bulk-inserts pending rows for contacts marked sent in `from`.
3. Row toggle → Server Action `setHolidaySent({contactId, year, sent, channel?})`.

### 5.4 CUJ 4 — Tag filter
1. User toggles tag chip → URL search param `?tag=id1,id2`.
2. RSC re-renders → repository query joins `contact_tags` with `HAVING COUNT(DISTINCT tag_id) = N` (AND semantics).

## 6. Search & Matching Strategy

- Maintain a `search_index` table populated by triggers on insert/update of `contacts`, `kids`, `messaging_handles`: `contact_id, token`.
- For **search** in the contacts list: SQL `LIKE '%q%'` over the token column (fast enough for 2k contacts).
- For **voice match**: load all `(contact_id, display_string)` rows into memory at request time (2k rows ≈ 200KB; acceptable) and run Fuse.js with `threshold: 0.4`, weighted toward exact-prefix matches on names. Return top 3 with scores.

## 7. Concurrency & Integrity

- Only one user; still wrap multi-insert flows in a DB transaction for atomicity.
- `better-sqlite3` is synchronous — no race issues within a request.
- `note_entries` are append-only; edits allowed via a separate `edited_at` + `body` update but the original is preserved in an `audit_log` table (V1 design; may defer to V1.1 if we want).

## 8. Security & Privacy

- Local DB file; no network egress for user data in V1.
- Server Actions validate + sanitize all input with zod.
- CSP set to `default-src 'self'` with specific allowances for speech and font assets.
- Audio stream stays in the browser; transcripts only are persisted.
- Backup/restore uses user-initiated file download/upload — no cloud.

## 9. PWA & Offline

- `manifest.webmanifest` with icons, theme color, `display: standalone`.
- Service worker caches the app shell + static assets; network-first for API calls with a stale-while-revalidate fallback for `GET /api/contacts`.
- Writes fail fast if offline in V1 (show toast). Offline writes queue is V1.1.

## 10. Deployment

- Local dev: `pnpm dev`; SQLite at `./data/personalcrm.sqlite`.
- Production V1: self-host via Docker on a home server, or run on the user's laptop. Image bundles the Next.js server + SQLite file in a mounted volume.
- Environment vars: `DATABASE_URL`, `PORT`, `VOICE_PROVIDER` (`browser` | `whisper`), `WHISPER_API_KEY` (V1.1).

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Web Speech API inconsistent on iOS | Voice CUJ degraded | Detect support; fallback to text input; V1.1 server-side Whisper. |
| SQLite file corruption (power loss) | Data loss | Enable WAL mode; nightly file backup to user-chosen folder. |
| User opens on multiple devices | Divergent data | Document V1 as single-device; export/import for manual sync. |
| Name fuzzy match false positives | Wrong contact gets note | Always show top-3 with scores; require explicit tap; never auto-confirm. |

## 12. Out of Scope (restated)

Multi-user, real-time sync, WhatsApp/WeChat chat ingestion, AI summarization, reminders, push notifications.
