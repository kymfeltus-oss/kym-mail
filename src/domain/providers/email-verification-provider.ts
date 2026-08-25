import type { VerificationResult } from "@/lib/contacts/types";

export interface EmailVerificationProvider {
  readonly key: string;
  verify(input: { email: string }): Promise<{ result: VerificationResult; usage: { requests: number; credits: number | null } }>;
}
