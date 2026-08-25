import type { DiscoveredPerson, TargetRole } from "@/lib/contacts/types";

export type PeopleDiscoveryRequest = {
  organization: { canonicalName: string; domain: string | null; alternateNames: string[] };
  targetRoles: TargetRole[];
  limit: number;
};

export interface PeopleDiscoveryProvider {
  readonly key: string;
  search(request: PeopleDiscoveryRequest): Promise<{ people: DiscoveredPerson[]; usage: { requests: number; credits: number | null } }>;
}
