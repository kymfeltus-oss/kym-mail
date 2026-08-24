# Engineering handover

KYM Mail contains the verified Gate 1 foundation, Gate 2 Mail Core, and Gate 3 Projects contextual layer. It is a Next.js/React/TypeScript application with real Supabase authentication and RLS, one Google mailbox connection, two verified sending identities, a unified inbox/sent/thread experience, compose/send/reply, attachment handling, bounded Gmail synchronization, Pub/Sub notifications, owner-scoped Projects, deterministic Project Activity, structured logging, and tests.

## Ownership and service relationships

The canonical source repository is `https://github.com/kymfeltus-oss/kym-mail`, and this project directory is its root. KYM Mail is intentionally isolated from the unrelated parent `Identification-Engine` repository and its history. Production is `https://www.kymmailapp.com` in the Vercel project `kym-mail`. Persistence and owner authentication use Supabase project `wrmemvvzdxxzwstnjcau`. Gmail OAuth, Gmail API, and Pub/Sub resources use Google Cloud project `kym-mail`.

Vercel and local development receive secrets only through environment stores. Do not put secret values, `.env` files, downloaded OAuth credential JSON, screenshots containing credentials, Supabase service-role keys, OAuth state secrets, or token-encryption keys in Git, documentation, support output, or application logs. Rotate any credential immediately if it is displayed or shared outside its intended secret store.

Major directories: `src/app` owns routes and server actions; `src/components` owns shared presentation; `src/domain` owns vendor-neutral contracts; `src/lib` owns auth, Supabase access, environment handling, errors, and logging; `supabase/migrations` owns schema history; `docs` explains operations and architectural law.

Follow the README to run, test, and build. Deployment is standard Vercel plus independently managed Supabase migrations. Runtime dependencies are Next.js, React, Supabase SSR/client, Zod, and Lucide icons. Tailwind and quality tooling are development dependencies.

KYM Mail records multiple owner mail identities. `kym@kymmailapp.com` is the default professional/direct sender and `info@kymmailapp.com` is the general/business sender. They use the owner-controlled production domain because `kym.com` was unavailable. They are identities within one unified mailbox experience, not separate apps or authentication users. This mail-identity change does not by itself change the private owner's Supabase authentication email.

Gate 3 uses one Project table with five validated types and four persisted statuses. Project type is intentionally immutable in V1. Parameters are explicit versioned Zod contracts persisted as JSONB; they are not a generic extension bucket. The owner-facing delete policy is Archive/Restore. The default sender references a real mail identity; if it becomes unavailable, the Project remains readable and Compose requires an explicit usable sender instead of silently falling back. Ordinary global mail remains available with no Project.

Intentionally deferred from Gate 3: scheduled sending, a full draft-management UI, additional mail providers, AI providers and features, career profile, job-provider search and analysis, contact/email discovery, resume/presentation generation, and outreach orchestration. The locked future career-outreach architecture is maintained in `docs/future-career-outreach-workflow.md`; its Project context foundation is implemented, but its future actions remain roadmap only.
