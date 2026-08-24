# Providers

`src/domain/providers` contains deliberately small `MailProvider` and `AIProvider` contracts. Gate 2 implements the mail contract in `src/integrations/google/google-mail-provider.ts`; the AI contract remains unimplemented.

Vendor adapters belong outside domain logic and implement these contracts. Domain services receive a provider implementation rather than importing Google APIs directly. The Google adapter owns token refresh, profile/send-as discovery, message/history reads, sends, attachment downloads, and Gmail watch creation. It translates provider failures into safe application errors and marks a connection `reauth_required` when refresh cannot recover.

One `mail_connections` record represents the connected Google mailbox. Multiple `mail_accounts` identities link to that connection and preserve their identity on messages and threads. KYM Mail therefore exposes one inbox, sent view, thread system, and composer while retaining the selected sender. `kym@kymmailapp.com` and `info@kymmailapp.com` are verified Gmail send-as identities backed by owner-controlled IONOS delivery/forwarding.

OAuth uses the minimum Gate 2 scope, `gmail.modify`, and a signed state value bound to the owner and connection. Credentials are encrypted at rest in the server-only credential table. Gmail push uses a Pub/Sub watch, authenticated push subscription, deduplicated notification persistence, and incremental history synchronization. Initial reconciliation is bounded to 30 days and only imports mail involving a configured KYM identity; history gaps fall back to the same bounded reconciliation. A watch is renewed when less than 24 hours remain.
