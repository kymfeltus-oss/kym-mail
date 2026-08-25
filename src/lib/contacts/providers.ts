import type { EmailDiscoveryProvider } from "@/domain/providers/email-discovery-provider";
import type { EmailVerificationProvider } from "@/domain/providers/email-verification-provider";
import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";
import { ApolloContactProvider } from "@/integrations/apollo/apollo-contact-provider";
import { getContactProviderEnv, hasContactProviderEnv } from "@/lib/env";

export type ContactProviderBundle = {
  people: PeopleDiscoveryProvider | null;
  email: EmailDiscoveryProvider | null;
  verification: EmailVerificationProvider | null;
};

// Gate 9 never substitutes fixtures or speculative provider output in production.
// The Apollo adapter is activated only by its server-only key. A missing key keeps
// the existing truthful provider-not-configured state.
export function getContactProviders(input: Record<string, string | undefined> = process.env): ContactProviderBundle {
  if (!hasContactProviderEnv(input)) return { people: null, email: null, verification: null };
  const apollo = new ApolloContactProvider(getContactProviderEnv(input));
  return { people: apollo, email: apollo, verification: null };
}

export function getContactProviderConfiguration(providers: ContactProviderBundle = getContactProviders()) {
  return {
    people: providers.people?.key ?? null,
    email: providers.email?.key ?? null,
    verification: providers.verification?.key ?? null
  };
}
