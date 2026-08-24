# Database

Supabase-managed PostgreSQL is the database. Migrations in `supabase/migrations` are the only schema change mechanism and run in filename order.

Gate 1 established `public.profiles` and owner-scoped `public.mail_accounts`. Gate 2 adds `mail_connections`, the server-only `mail_connection_credentials`, unified `mail_threads`, `mail_messages`, attachment metadata, and deduplicated provider notifications. A connection is distinct from a sending identity: both configured addresses link to the same Google mailbox connection. Provider IDs are unique within that connection, and each thread/message retains the relevant account identity. Row-level security restricts owner resources to the authenticated owner; the encrypted credential and notification tables expose no client policy.

Migrations `202608240003` through `202608240006` are the authoritative Gate 2 schema. They deliberately avoid Project, job, contact, resume, AI, and outreach models. Future gates should add normalized tables only for validated use cases, enforce relationships and uniqueness in PostgreSQL, and keep one source of truth per concept.
