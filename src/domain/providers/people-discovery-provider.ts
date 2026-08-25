import type { DiscoveredPerson, TargetRole } from "@/lib/contacts/types";

export type PeopleDiscoveryRequest = {
  organization: { canonicalName: string; domain: string | null; alternateNames: string[] };
  targetRoles: TargetRole[];
  limit: number;
};

export type ProviderResolvedOrganization = {
  providerKey: string;
  sourceRecordId: string;
  canonicalName: string;
  domain: string | null;
  alternateNames: string[];
  confidence: number;
  sourceUrl: string | null;
};

export interface PeopleDiscoveryProvider {
  readonly key: string;
  search(request: PeopleDiscoveryRequest): Promise<{
    people: DiscoveredPerson[];
    resolvedOrganization?: ProviderResolvedOrganization;
    usage: { requests: number; credits: number | null };
  }>;
}
