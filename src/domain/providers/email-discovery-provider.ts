import type { DiscoveredEmail, DiscoveredPerson } from "@/lib/contacts/types";

export interface EmailDiscoveryProvider {
  readonly key: string;
  findBusinessEmails(input: { person: DiscoveredPerson; organizationDomain: string | null }): Promise<{ emails: DiscoveredEmail[]; usage: { requests: number; credits: number | null } }>;
}
