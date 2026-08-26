# KYM Mail

KYM Mail is a private email and career-outreach application. This independent repository contains the Gate 1 foundation through Gate 8 Hiring Intelligence plus an isolated Calendar and paid-consultation flow: real Supabase authentication, an owner-scoped unified mailbox, contextual Projects, deterministic scheduled delivery, real Adzuna job discovery, Saved Jobs, the authoritative Master Career Profile, evidence-linked job-match analysis, versioned factual resume generation with DOCX/PDF export, owner-secured people research, and manual Zelle proof approval before Cal.com booking access.

The production Apollo organization/people adapter remains disabled until `APOLLO_API_KEY` is configured and live-verified. Gate 8 does not discover, infer, verify, display, or use email addresses. Email Intelligence and downstream outreach remain future gated work.

## Canonical environments

- Repository: `https://github.com/kymfeltus-oss/kym-mail`
- Production: `https://www.kymmailapp.com`
- Vercel project: `kym-mail`
- Supabase project reference: `wrmemvvzdxxzwstnjcau`
- Google Cloud project: `kym-mail`

This directory is the KYM Mail repository boundary. It is not part of the unrelated parent `Identification-Engine` repository, and files from that project must never be staged here.

## Quick start

1. Use Node.js 22 or newer and run `npm install`.
2. Create a Supabase project, apply all migrations in `supabase/migrations` in filename order, and create the single owner in Supabase Authentication.
3. Copy `.env.example` to `.env.local` and fill in the Supabase, server-only Google Mail, scheduler, Cal.com webhook, Adzuna, and—when enabling Gate 8 live people research—Apollo values. Adzuna credentials come from [developer.adzuna.com](https://developer.adzuna.com/) and Apollo credentials from [Apollo API setup](https://docs.apollo.io/reference/apollo-api); all secrets must remain server-only. Never commit `.env` files, OAuth/client/API secrets, service-role keys, token-encryption keys, downloaded credential JSON, or platform metadata.
4. Run `npm run dev`, then open `http://localhost:3000`.

Career imports are an owner-approved administrative operation. Validate an intake manifest and run `npm run career:import -- <path>` only with the server-only service-role environment configured. The authenticated owner may review and edit factual records in the Master Career Profile; every edit is forced to resolved authority and preserved in private immutable history. Intake manifests and source resumes are not application assets and must not be committed.

Gate 6A adds the low-cost source-to-authority workflow around that profile. The two reviewed resume extractions are persisted once by source SHA-256; deterministic comparison creates candidate facts, auto-confirms only exact low-risk dual-source technology/system facts, and sends conflicts or unique claims to one owner-only Review Needed queue. Owner resolutions and edits create numbered fact versions and provenance. A later import may suggest a change but cannot silently replace `OWNER_CONFIRMED` data. Resume PDFs remain outside the repository and are never served by the app.

Gate 6B adds persisted Career Match intelligence to a Saved Job. The deterministic v2 analyzer independently classifies `REQUIRED`, `PREFERRED`, `RESPONSIBILITY`, and `CONTEXT` requirements, grounds every requirement in the stored job description, and permits positive evidence links only to `AUTHORITATIVE` or owner-`RESOLVED` Master Career Profile records. The WHY screen explains supported matches, genuine gaps, potentially under-emphasized authoritative evidence, and a factual résumé strategy without generating a résumé or calling an external AI service. The 12 unresolved Gate 6A review candidates remain excluded.

Quality commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit`.

During local UI development, the temporary server-only auth bypass can be enabled with `KYM_DEV_AUTH_BYPASS=true`; see `docs/security.md`. It is forcibly disabled in production and does not change database RLS.

Calendar settings live at `/app/calendar`; public consultation intake lives at `/consult`. Cal.com is the only scheduling provider and must be connected to Google Calendar in Cal.com. KYM Mail offers only the fixed 60-minute first-time ($200) and returning-client ($150) paid consultations; there is no free-meeting flow. KYM Mail never calls Zelle: it accepts a private proof upload, records a manual owner decision, and releases an expiring token only after approval.

See [architecture](docs/architecture.md), [database](docs/database.md), [providers](docs/providers.md), [security](docs/security.md), [testing](docs/testing.md), [deployment](docs/deployment.md), [handover](docs/handover.md), and the [locked future career-outreach architecture](docs/future-career-outreach-workflow.md). That roadmap distinguishes implemented workflow gates from provider-dependent and future outreach work.
