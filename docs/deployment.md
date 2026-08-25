# Deployment

## Canonical targets

- GitHub: `https://github.com/kymfeltus-oss/kym-mail`
- Vercel project: `kym-mail`
- Production domain: `https://www.kymmailapp.com`
- Supabase project reference: `wrmemvvzdxxzwstnjcau`
- Google Cloud project: `kym-mail`

The KYM Mail project root is its own Git repository. Do not initialize, stage, or deploy it through the unrelated parent `Identification-Engine` worktree.

## Local

Use Node 22, install dependencies, apply all SQL migrations in filename order to Supabase, copy `.env.example` to `.env.local`, and run `npm run dev`. Create the private owner in the Supabase dashboard; public signup is intentionally absent. Configure mail identities as owner-scoped `mail_accounts`; do not create separate authentication users for sender addresses.

## Vercel

Connect the canonical repository, use the standard Next.js build, and set every value documented in `.env.example` for the intended environment. `SUPABASE_SERVICE_ROLE_KEY`, Google OAuth secrets, the OAuth state secret, the token-encryption key, and `CRON_SECRET` are server-only. Configure production/site URLs and allowed redirects in Supabase Authentication and Google OAuth. Apply migrations separately before deployment. Run lint, typecheck, tests, build, and `npm audit` in CI.

Store live values only in `.env.local` and the Vercel environment-variable store. These values are never committed, copied into docs, or logged. Downloaded OAuth credential files are also excluded. Secret rotation must update both stores, retire the prior credential at the provider, redeploy production, and reverify OAuth, token refresh, synchronization, and sending.

The app fails with a safe error when required configuration is missing. Preview deployments need their own permitted redirect URL. Pub/Sub must use the exact canonical HTTPS webhook as both push endpoint and OIDC audience, and its push service account must match `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT`.

Gate 5 also requires server-only `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` values in local development and the Vercel production environment. Obtain them from the Adzuna Developer Portal, accept and follow its API terms/attribution requirements, and never expose them to client JavaScript or logs. The default limits are low enough that manual searches and Save verification should remain deliberate; a Save performs a second provider call to verify facts before persistence. Do not add automatic polling, job alerts, or provider monitoring under Gate 5.

Gate 8 adds no external AI secret or resume-storage bucket. The configured deterministic provider reads the owner-scoped Gate 6/7 records through the authenticated server boundary. DOCX and PDF files are created on demand by a Node.js route, returned with private/no-store headers, and not persisted as public files. Apply migration `202608250013_tailored_resume_engine.sql` before deploying the Gate 8 routes. If a future AI provider is added, its key must remain server-only and its structured output must pass the same factual validator before persistence.

For local development only, set `KYM_DEV_AUTH_BYPASS=true`, `KYM_DEV_OWNER_EMAIL` to an existing private owner, and `SUPABASE_SERVICE_ROLE_KEY` to the server-only project key. Set the flag to `false` to test normal login. Vercel production always ignores the bypass flag because the application also requires `NODE_ENV !== "production"`; do not configure the service-role key in client-prefixed variables.

## Scheduled delivery operations

`vercel.json` registers `GET /api/cron/scheduled-mail` every minute. Vercel Cron schedules are UTC, but each record stores a canonical `timestamptz` plus its IANA timezone for owner-facing display. Configure a high-entropy `CRON_SECRET` in the Vercel production environment before deploying; Vercel adds it as `Authorization: Bearer …` to cron requests. A direct unsigned request must return 401. The configured Vercel plan must support one-minute cron frequency.

The executor safely overlaps: PostgreSQL claims due rows atomically, and the stable RFC Message-ID reconciles an ambiguous Gmail result before any retry. Automatic retries are limited to three attempts and use short deterministic backoff only for transient errors. Revoked OAuth, invalid content, missing attachments, and unavailable identities fail for owner action rather than switching sender or retrying forever. Stale `PROCESSING` rows recover after ten minutes. Operational checks should inspect safe status/error fields and structured event names; never log or query-export message bodies, recipients, tokens, or secrets for troubleshooting.

To recover production, first restore OAuth/identity/attachment availability, then use the owner-visible Retry action on a `FAILED` record. Do not update `PROCESSING`/`SENT` states manually or delete `CANCELLED` history. A replacement executor may call the same service-only claim/recovery functions and existing `MailProvider`; Compose does not need to change.
