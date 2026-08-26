import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("./workflow.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/jobs/[jobId]/contacts/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/202608260023_gate8_hiring_intelligence.sql", import.meta.url), "utf8");

describe("Gate 8 boundary contract", () => {
  it("does not call or persist email intelligence", () => {
    expect(workflow).not.toMatch(/findBusinessEmails|job_contact_emails|verification_provider_key:\s*providers/);
    expect(route).not.toMatch(/emailType|email:\s*z\.|SELECT_PREFERRED/);
  });

  it("requires explicit owner approval and supports rejection", () => {
    expect(route).toContain('action: z.literal("APPROVE")');
    expect(route).toContain('action: z.literal("REJECT")');
    expect(migration).toContain("create function public.approve_job_contact");
    expect(migration).toContain("create function public.reject_job_contact");
    expect(migration).toContain("job_contacts_one_approved_idx");
  });

  it("retains the Job and Project boundary", () => {
    expect(migration).toContain("validate_gate8_contact_project");
    expect(migration).toContain("job_opportunity_projects");
    expect(migration).toContain("project_id uuid references public.projects(id)");
  });

  it("defines independent verification, relevance, and stale states", () => {
    expect(migration).toContain("STALE_OR_UNCERTAIN");
    expect(migration).toContain("relevance_level");
    expect(migration).toContain("approval_state");
    expect(migration).toContain("verification_state = 'STALE_OR_UNCERTAIN'");
  });

  it("retires the legacy preferred-contact RPC from authenticated use", () => {
    expect(migration).toContain("revoke all on function public.set_preferred_job_contact(uuid, uuid) from authenticated");
  });
});
