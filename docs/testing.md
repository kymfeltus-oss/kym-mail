# Testing

Run `npm test` for Vitest unit tests. Current coverage verifies credential structure, environment failure behavior, safe error translation, sensitive logging redaction, Pub/Sub/OIDC validation, Gmail payload normalization and HTML sanitization, and compose/attachment input rules. Run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm audit` for static, production, and dependency checks.

Live verification requires the configured Supabase owner, Google OAuth test user, Gmail API, Pub/Sub topic and authenticated push subscription, verified sender aliases, and Vercel deployment. Verify connection, bounded initial sync, incremental push sync, sender selection, external send/receipt, reply ingestion, thread continuity, attachment handling, reconnect behavior, protected production routes, and desktop/tablet/mobile rendering. Tests protect behavior and boundaries; they do not substitute for the required live mail journey.
