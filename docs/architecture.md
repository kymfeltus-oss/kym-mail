# Architecture

## KYM Mail is Logic-Driven and AI-Executed

Deterministic application logic owns state, validation, workflow progression, permissions, persistence, scheduling, provider orchestration, factual records, approval boundaries, business rules, and error handling. Future AI may execute bounded extraction, interpretation, ranking, summarization, personalization, drafting, and classification tasks. It is never the state machine or source of truth.

The required future flow is: input contract → deterministic validation → AI execution → structured response → schema validation → provenance validation → business-rule validation → persisted derived result. A `prompt → response → UI` design is prohibited.

Data has three conceptual layers. **Authoritative data** contains human-controlled facts and operational records and cannot be directly modified by AI. **Derived intelligence** contains validated AI-assisted interpretations and must retain provenance to supporting authoritative records. **Presentation** contains regenerable copy or views and never becomes the factual source of truth. Gate 1 persists only the authoritative owner profile; the latter layers are documented, not prematurely modeled.

Next.js route/server boundaries own transport and rendering. Domain code owns business concepts and provider contracts. Supabase owns managed PostgreSQL and authentication. UI components do not query the database directly. Future providers implement the small domain interfaces and are injected into domain services. State transitions remain deterministic and persisted before presentation.

## Unified mailbox identity direction

One authenticated owner may have multiple `mail_accounts` in a single KYM Mail workspace. Future inbox, sent, draft, scheduled, message, and thread models must retain their provider/account identity while remaining unified views—not duplicated mailbox implementations. Compose must offer a From selector whenever multiple active identities exist. Professional/direct outreach defaults to `kym@kymmailapp.com`; general or administrative communication defaults to `info@kymmailapp.com`. A future project may reference a default identity. The addresses use the owner-controlled production domain because the originally proposed `kym.com` domain was unavailable. Gate 1 established identity ownership and defaults; Gate 2 verifies their real provider configuration before enabling mail behavior.

## Locked future Projects and career workflow

The authoritative future Projects and Job Search → Career Match → Decision Maker → Email Intelligence → Individualized Outreach architecture is documented in [future-career-outreach-workflow.md](future-career-outreach-workflow.md). Projects provide optional context to shared global engines; they never duplicate Mail, Compose, Job Search, Contacts, Email Discovery, Resume Studio, or AI services. It is roadmap architecture only and is not part of Gate 2. After Mail Core achieves PASS, Projects are evaluated as the next implementation gate before Job Search and Career Intelligence. Mail Core preserves stable account/thread/message identifiers so later normalized, application-owned associations can be added without making Google authoritative for Projects, jobs, contacts, resumes, or outreach state.
