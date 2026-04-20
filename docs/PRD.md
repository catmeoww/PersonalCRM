# PersonalCRM — Product Requirements Document

## 1. Problem & Opportunity

Busy parents and professionals meet a lot of people in overlapping social circles (kids' school/sports, work, neighborhood, friends). Information learned in passing ("their daughter plays violin", "he works at Stripe in the Payments team", "they're going to Yosemite for spring break") is valuable for building relationships but is forgotten in days. Existing contact apps (iOS Contacts, Google Contacts) store static fields, not the living context that makes a relationship real. Note-taking apps (Notes, Notion) hold prose but don't let you say "Emily's dad" and jump to the right person.

PersonalCRM is a lightweight personal relationship manager focused on the things native contacts and note apps both miss: **kids**, **context notes over time**, **platform handles (WhatsApp/WeChat)**, **tags across life-circles**, and **holiday-card history**. It is mobile-first because most of these updates happen immediately after a conversation, on the phone, often by voice.

## 2. Target User

**Primary persona — "Parent-Professional Pat"**
- Has 1+ kids in school; attends class parties, sports games, weekend hangouts.
- Active professionally: colleagues across teams, past teams, industry friends.
- Chats happen across iMessage, WhatsApp, WeChat.
- Sends 30–150 holiday cards per year.
- Uses the app overwhelmingly on a phone, occasionally on laptop.
- Not a power user of databases — UI must feel like a notes app, not Salesforce.

V1 is single-user, local-first. Multi-user / family-shared is explicitly out of scope.

## 3. Goals & Non-Goals

### Goals (V1)
- G1. Capture a new contact + their kids + messaging handle in ≤ 60 seconds while still at a party.
- G2. Append a note to an existing contact by voice in ≤ 10 seconds, without typing their full name.
- G3. Produce a holiday-card list for the current year, pre-seeded with last year's recipients.
- G4. Let the user slice contacts by tags across life-circles (work team, parents group, college friends, etc.).
- G5. Preserve note history — every update is an append, not an overwrite, so the user can see what they learned and when.

### Non-Goals (V1)
- Real-time sync across devices (local SQLite only; data export for backup).
- Integrating with WhatsApp / WeChat APIs to pull chat content (we only store the handle).
- Contact de-duplication against iOS/Google contacts.
- Multi-user, shared, or team accounts.
- AI summarization of notes, reminders, or scheduled follow-ups.
- Full-text search with ranking (simple LIKE search is enough for V1).

## 4. Core User Journeys

### CUJ 1 — Add a new contact at a party (primary on-phone flow)
**Context**: Pat is at a Pinewood school party. Meets Jenny, whose son Lucas is in 2nd grade with Pat's son and plays soccer. They exchange WeChat.

**Flow**:
1. Pat opens the app → taps **+ New Contact** on the Contacts tab.
2. Enters name "Jenny Wang".
3. Taps **+ Add Kid** → enters "Lucas", grade "2", sports tag "Soccer".
4. Taps **+ Add Handle** → picks "WeChat", types/pastes handle `jenny_w88`.
5. Free-form notes field: "Met at Pinewood spring party. Works at Google Ads."
6. Taps tag chips: **Pinewood Parents**, **Grade 2**.
7. Saves. Returns to contacts list with Jenny at top.

**Success metric**: p90 time-to-save ≤ 60s on phone.

### CUJ 2 — Voice-update an existing contact
**Context**: Pat is chatting in the school pickup line. Learns Lucas is going to Camp Galileo this summer.

**Flow**:
1. Pat opens the app → taps **Voice** tab → big mic button.
2. Speaks: *"Lucas Wang is going to Camp Galileo this summer."*
3. App transcribes, fuzzy-matches "Lucas Wang" → shows 1–3 candidate contacts (matching by contact name, kids' names, nicknames).
4. Pat taps the right one → the transcript is appended to that contact's notes timeline with a timestamp. Source flagged as "voice".
5. Pat can edit the transcript before confirming save.

**Success metrics**:
- p90 mic-tap to saved note ≤ 10s.
- Top-1 match accuracy ≥ 80% when the spoken identifier is an exact name or kid's name.
- User can always fall back to a typeahead search if no candidate is right.

### CUJ 3 — Holiday card planning
**Context**: Late November. Pat wants to send holiday cards and not forget anyone from last year.

**Flow**:
1. Pat opens **Holiday** tab.
2. Sees a table of contacts with two columns: "Sent 2025" and "Sent 2026" (current year).
3. A **Copy from last year** action pre-checks the 2026 column for everyone checked in 2025.
4. Pat can filter by tag (e.g., only "Pinewood Parents") to go through circles one by one.
5. For each contact, Pat can toggle sent/not-sent, optionally note the channel (physical, e-card, digital).
6. **Export** → CSV of current-year recipients with mailing-related fields (for use in Minted / Shutterfly).

**Success metrics**:
- "Copy from last year" completes in one tap.
- Year-over-year history is queryable indefinitely (not just 2 years).

### CUJ 4 — Tag a contact into life-circles
**Context**: Pat wants to filter to "Payments team coworkers" before sending a team lunch invite.

**Flow**:
1. On a contact's detail page, Pat taps **Tags** and adds "Work — Payments", "Work — Current".
2. Tags auto-complete; creating a new tag is inline.
3. Tags carry a **category** (Work / Parents / Social / Family / Custom) for grouping.
4. On the Contacts tab, Pat can filter by one or multiple tags (AND semantics).

**Success metrics**:
- A contact can hold ≥ 10 tags without UI clutter.
- Tag filter returns in < 200ms for libraries up to 2,000 contacts.

## 5. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Create, read, update, delete contacts with name, optional aliases/nicknames, work, free-form bio. | P0 |
| FR-2 | Attach one or more kids per contact with name, grade, school, sports, interests. | P0 |
| FR-3 | Attach one or more messaging handles per contact with platform (WhatsApp, WeChat, iMessage/SMS, Email, Other). | P0 |
| FR-4 | Append-only note entries per contact, timestamped, with source (typed/voice). | P0 |
| FR-5 | Tags with category; many-to-many to contacts; inline create. | P0 |
| FR-6 | Voice capture → transcript → fuzzy candidate match → confirm + append. | P0 |
| FR-7 | Holiday-card tracker: per contact, per year, sent flag, channel, notes; "copy last year" action. | P0 |
| FR-8 | Contacts list with search by name/kid/handle and filter by tag. | P0 |
| FR-9 | CSV export of contacts and of current-year holiday list. | P1 |
| FR-10 | JSON backup + restore of full database. | P1 |
| FR-11 | Installable as a PWA on iOS/Android home screens. | P1 |
| FR-12 | Dark mode, accessible tap targets (≥ 44×44 px). | P1 |

## 6. Non-Functional Requirements

- **Performance**: Contacts list of 2,000 renders in < 300ms. Voice transcribe-to-saved note ≤ 10s p90.
- **Offline**: All CRUD works offline once the PWA is installed (voice transcription requires network unless browser STT is on-device).
- **Privacy**: Data lives on the user's device (SQLite file). No third-party analytics in V1. Voice audio never stored; only transcripts are persisted.
- **Accessibility**: WCAG 2.1 AA contrast, screen-reader labels on icon buttons, form fields have visible labels.
- **Browser support**: Latest Chrome, Safari iOS 16+, Edge. (Web Speech requires webkit prefix on Safari.)

## 7. Metrics for Success

- **Activation**: ≥ 80% of users create ≥ 5 contacts within first week.
- **CUJ-1 time**: median time to save a new contact ≤ 45s.
- **CUJ-2 usage**: ≥ 30% of notes added via voice after week 2.
- **CUJ-3 retention**: ≥ 70% of users with a previous year's list use "Copy from last year".
- **Data integrity**: 0 reports of lost notes (append-only design).

## 8. Release Plan

- **V1 (MVP)**: FR-1 through FR-8 + FR-11. Ship as PWA.
- **V1.1**: FR-9, FR-10, tag color coding, duplicate detection warning on name collision.
- **V2 (future)**: multi-device sync (Supabase or iCloud folder), reminders, summarization with on-device LLM.

## 9. Open Questions

- Should voice transcription also send transcripts through an LLM to extract structured fields (e.g., auto-fill "summer camp = Galileo")? Deferred to V2 — keep V1 purely as transcript-append.
- iOS Safari sometimes blocks `webkitSpeechRecognition` in PWAs launched from the home screen. Fallback: in-browser MediaRecorder → Whisper API. Flag behind a setting.
- Should handles deep-link into the respective apps (e.g., `weixin://` for WeChat)? Investigate per-platform URL schemes in V1.1.
