import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";
import { ApolloContactProvider } from "@/integrations/apollo/apollo-contact-provider";
import { getContactProviderEnv, hasContactProviderEnv } from "@/lib/env";

export type ContactProviderBundle = {
  people: PeopleDiscoveryProvider | null;
};

// Gate 8 never substitutes fixtures or speculative provider output in production.
// The Apollo adapter is activated only by its server-only key. A missing key keeps
// the existing truthful provider-not-configured state.
export function getContactProviders(input: Record<string, string | undefined> = process.env): ContactProviderBundle {
  if (!hasContactProviderEnv(input)) return { people: null };
  const apollo = new ApolloContactProvider(getContactProviderEnv(input));
  return { people: apollo };
}

export function getContactProviderConfiguration(providers: ContactProviderBundle = getContactProviders()) {
  return {
    people: providers.people?.key ?? null,
    requirement: providers.people ? null : "Configure server-only APOLLO_API_KEY with organization enrichment, People API Search, and People Enrichment access."
  };
}
