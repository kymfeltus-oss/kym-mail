# KYM Mail

KYM Mail is a private, intelligent email and career-outreach application. This independent repository contains the verified Gate 1 foundation, Gate 2 Mail Core, and Gate 3 Projects layer: real Supabase authentication, an owner-scoped unified mailbox, Google OAuth, Gmail synchronization, compose/send/reply, attachments, two verified sending identities, and persistent contextual Projects.

AI, job-provider search, career intelligence, contact discovery, resume functionality, scheduling, and outreach automation remain explicitly outside the verified Gate 3 scope.

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
3. Copy `.env.example` to `.env.local` and fill in the Supabase and server-only Google Mail values. Never commit `.env` files, OAuth client secrets, service-role keys, token-encryption keys, downloaded credential JSON, or platform metadata.
4. Run `npm run dev`, then open `http://localhost:3000`.

Quality commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit`.

During local UI development, the temporary server-only auth bypass can be enabled with `KYM_DEV_AUTH_BYPASS=true`; see `docs/security.md`. It is forcibly disabled in production and does not change database RLS.

See [architecture](docs/architecture.md), [database](docs/database.md), [providers](docs/providers.md), [security](docs/security.md), [testing](docs/testing.md), [deployment](docs/deployment.md), [handover](docs/handover.md), and the [locked future career-outreach architecture](docs/future-career-outreach-workflow.md). That roadmap distinguishes the implemented Gate 3 Project context from later unimplemented workflows.
