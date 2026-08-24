# Architecture

## KYM Mail is Logic-Driven and AI-Executed

Deterministic application logic owns state, validation, workflow progression, permissions, persistence, scheduling, provider orchestration, factual records, approval boundaries, business rules, and error handling. Future AI may execute bounded extraction, interpretation, ranking, summarization, personalization, drafting, and classification tasks. It is never the state machine or source of truth.

The required future flow is: input contract → deterministic validation → AI execution → structured response → schema validation → provenance validation → business-rule validation → persisted derived result. A `prompt → response → UI` design is prohibited.

Data has three conceptual layers. **Authoritative data** contains human-controlled facts and operational records and cannot be directly modified by AI. **Derived intelligence** contains validated AI-assisted interpretations and must retain provenance to supporting authoritative records. **Presentation** contains regenerable copy or views and never becomes the factual source of truth. Gates 1–4 persist authoritative owner, mail, Project, and scheduling records; derived intelligence remains documented but unimplemented.

Next.js route/server boundaries own transport and rendering. Domain code owns business concepts and provider contracts. Supabase owns managed PostgreSQL and authentication. UI components do not query the database directly. Future providers implement the small domain interfaces and are injected into domain services. State transitions remain deterministic and persisted before presentation.

## Unified mailbox identity direction

One authenticated owner may have multiple `mail_accounts` in a single KYM Mail workspace. Future inbox, sent, draft, scheduled, message, and thread models must retain their provider/account identity while remaining unified views—not duplicated mailbox implementations. Compose must offer a From selector whenever multiple active identities exist. Professional/direct outreach defaults to `kym@kymmailapp.com`; general or administrative communication defaults to `info@kymmailapp.com`. A future project may reference a default identity. The addresses use the owner-controlled production domain because the originally proposed `kym.com` domain was unavailable. Gate 1 established identity ownership and defaults; Gate 2 verifies their real provider configuration before enabling mail behavior.

## Projects as shared-service context

Gate 3 implements one owner-scoped `projects` model as an optional contextual layer over the existing global application. Project types are deterministic and immutable after creation. Type-specific parameters use explicit version-1 Zod schemas and server validation before JSONB persistence. Projects reference a real `mail_accounts` row for their default sender, while Compose remains the single shared engine and supports `Project: None` for ordinary mail.

Threads and messages have nullable application-owned Project associations. A linked thread is the authoritative continuity mechanism: later messages and incoming replies inherit the existing thread's Project without changing provider identifiers or duplicating mail. A small deterministic activity log records only persisted creation, update, status, send, and reply events. Archive is the owner-facing deletion policy; permanent deletion is intentionally absent.

The unimplemented Job Search → Career Match → Decision Maker → Email Intelligence → Individualized Outreach roadmap remains in [future-career-outreach-workflow.md](future-career-outreach-workflow.md). Future shared services consume validated Project context; they must not create Project-specific copies of Mail, Compose, Job Search, Contacts, Email Discovery, Resume Studio, or AI systems.

## Scheduled delivery

Gate 4 extends the existing Compose and Mail Core instead of creating a second mail system. A `scheduled_messages` row is the authoritative approved delivery snapshot: sender identity, recipients, content, provider thread/reply context, Project, canonical UTC instant, display timezone, status, attempts, and provider result. Attachments are relational metadata backed by the private `scheduled-mail-attachments` Supabase Storage bucket. The snapshot remains editable only while `SCHEDULED`; optimistic versions and conditional updates reject stale edits and mutations.

The deterministic state machine is `SCHEDULED → PROCESSING → SENT`, `SCHEDULED → CANCELLED`, or `PROCESSING → SCHEDULED/FAILED`. A Vercel Cron request invokes one protected executor every minute. PostgreSQL claims eligible rows atomically with `FOR UPDATE SKIP LOCKED`; the executor revalidates the exact sender, retrieves and checksums attachments, then calls the existing `MailProvider`. A stable RFC Message-ID lets retries search Gmail before sending, preventing another send after an ambiguous provider response. Successful delivery is synchronized into the ordinary Sent/thread model with the preserved Project. The executor boundary is replaceable without changing Compose or the provider contract.
