import type { EmailDiscoveryProvider } from "@/domain/providers/email-discovery-provider";
import type { EmailVerificationProvider } from "@/domain/providers/email-verification-provider";
import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";

export type ContactProviderBundle = {
  people: PeopleDiscoveryProvider | null;
  email: EmailDiscoveryProvider | null;
  verification: EmailVerificationProvider | null;
};

// Gate 9 never substitutes fixtures or speculative provider output in production.
// A real vendor adapter is registered here only after its server-side credentials
// and terms are configured and its live response mapping has been verified.
export function getContactProviders(): ContactProviderBundle {
  return { people: null, email: null, verification: null };
}

export function getContactProviderConfiguration(providers: ContactProviderBundle = getContactProviders()) {
  return {
    people: providers.people?.key ?? null,
    email: providers.email?.key ?? null,
    verification: providers.verification?.key ?? null
  };
}
