# Security

Gate 1 uses server-verified Supabase sessions. The proxy refreshes sessions and redirects unauthenticated `/app` requests; the protected page independently calls `getUser()` before rendering. Logout invalidates the session. PostgreSQL row-level security constrains owner profile access.

Only the Supabase project URL and anon key may enter the client bundle. They are identifiers, not privileged credentials, and RLS remains mandatory. The service-role key, Google client secret, OAuth state secret, and mail-token encryption key remain server-only. OAuth access and refresh tokens are encrypted before persistence and are never returned to the browser or logged. Environment files are ignored; `.env.example` contains placeholders. Inputs are validated with Zod, but structural validity does not establish factual truth. Domain errors expose safe messages, logs redact sensitive fields, error UI avoids internal detail, and baseline response headers disable framing/type sniffing and unnecessary browser capabilities.

Owner authorization and RLS apply to all mail resources. Same-origin checks protect owner mutations; OAuth state is signed and time-bounded; Pub/Sub push tokens are verified for issuer, exact audience, and service-account identity; duplicate notifications are idempotent. Rendered provider HTML is sanitized, remote/tracking images are removed, executable attachment extensions are blocked for sends, and attachment downloads remain authenticated and private. Dependency audits must run before release. No compliance certification is claimed.

## Temporary local authentication bypass

`KYM_DEV_AUTH_BYPASS=true` enables a development-only owner context. The authoritative check requires `NODE_ENV` to be non-production; production ignores the flag even if it is set. The resolver uses `KYM_DEV_OWNER_EMAIL` to find the existing owner and a server-only `SUPABASE_SERVICE_ROLE_KEY` to read through the same data client interface. Neither value enters the client bundle. The bypass has no rendered UI, badge, banner, or product-facing indicator; a structured server log is the only diagnostic.

Set the flag to `false` or remove it to restore normal Supabase authentication. The proxy, login, logout, session refresh, and RLS policies remain intact. RLS is not opened to anonymous users; the development resolver uses an isolated server-only administrative client because no user JWT exists in bypass mode. Remove the resolver and flag to retire the bypass.
