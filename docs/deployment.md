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

Connect the canonical repository, use the standard Next.js build, and set every value documented in `.env.example` for the intended environment. `SUPABASE_SERVICE_ROLE_KEY`, Google OAuth secrets, the OAuth state secret, and the token-encryption key are server-only. Configure production/site URLs and allowed redirects in Supabase Authentication and Google OAuth. Apply migrations separately before deployment. Run lint, typecheck, tests, build, and `npm audit` in CI.

Store live values only in `.env.local` and the Vercel environment-variable store. These values are never committed, copied into docs, or logged. Downloaded OAuth credential files are also excluded. Secret rotation must update both stores, retire the prior credential at the provider, redeploy production, and reverify OAuth, token refresh, synchronization, and sending.

The app fails with a safe error when required configuration is missing. Preview deployments need their own permitted redirect URL. Pub/Sub must use the exact canonical HTTPS webhook as both push endpoint and OIDC audience, and its push service account must match `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT`.

For local development only, set `KYM_DEV_AUTH_BYPASS=true`, `KYM_DEV_OWNER_EMAIL` to an existing private owner, and `SUPABASE_SERVICE_ROLE_KEY` to the server-only project key. Set the flag to `false` to test normal login. Vercel production always ignores the bypass flag because the application also requires `NODE_ENV !== "production"`; do not configure the service-role key in client-prefixed variables.
