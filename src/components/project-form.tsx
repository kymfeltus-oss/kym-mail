"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, Handshake, Shapes, Users } from "lucide-react";
import { projectTypeLabels, type ProjectType } from "@/lib/projects/constants";

export type ProjectIdentity = {
  id: string;
  email_address: string;
  label: string;
  is_default: boolean;
  is_active: boolean;
  send_as_state: string;
};

export type EditableProject = {
  id: string;
  type: ProjectType;
  name: string;
  objective: string;
  default_mail_account_id: string | null;
  parameters: Record<string, unknown>;
};

const choices = [
  { type: "JOB_SEARCH" as const, icon: BriefcaseBusiness, description: "Define target roles, skills, location, and seniority." },
  { type: "BUSINESS_OUTREACH" as const, icon: Building2, description: "Organize business outreach context and approved talking points." },
  { type: "PARTNERSHIP" as const, icon: Handshake, description: "Capture a partnership objective, organizations, and target roles." },
  { type: "NETWORKING" as const, icon: Users, description: "Keep networking goals and people context together." },
  { type: "CUSTOM" as const, icon: Shapes, description: "Create a simple context container for other work." }
];

const fieldClass = "w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal text-[#183A5A] outline-none placeholder:text-[#94A3B8] focus:border-[#D95B72]";
const params = (project?: EditableProject) => project?.parameters ?? {};
const stringParam = (project: EditableProject | undefined, key: string) => typeof params(project)[key] === "string" ? params(project)[key] as string : "";
const listParam = (project: EditableProject | undefined, key: string) => Array.isArray(params(project)[key]) ? (params(project)[key] as string[]).join("\n") : "";
const splitList = (value: string) => value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);

export function ProjectForm({ identities, project }: { identities: ProjectIdentity[]; project?: EditableProject }) {
  const router = useRouter();
  const availableIdentities = useMemo(() => identities.filter((identity) => identity.is_active && identity.send_as_state === "available"), [identities]);
  const [type, setType] = useState<ProjectType | null>(project?.type ?? null);
  const [name, setName] = useState(project?.name ?? "");
  const [objective, setObjective] = useState(project?.objective ?? "");
  const [identityId, setIdentityId] = useState(project?.default_mail_account_id ?? availableIdentities.find((identity) => identity.is_default)?.id ?? availableIdentities[0]?.id ?? "");
  const [targetRoles, setTargetRoles] = useState(listParam(project, "targetRoles") || listParam(project, "targetContactRoles"));
  const [keywords, setKeywords] = useState(listParam(project, "keywords"));
  const [locationText, setLocationText] = useState(stringParam(project, "locationText"));
  const [arrangements, setArrangements] = useState<string[]>(Array.isArray(params(project).arrangements) ? params(project).arrangements as string[] : []);
  const [minimumCompensation, setMinimumCompensation] = useState(params(project).minimumCompensation == null ? "" : String(params(project).minimumCompensation));
  const [seniority, setSeniority] = useState<string[]>(Array.isArray(params(project).seniority) ? params(project).seniority as string[] : []);
  const [organizationContext, setOrganizationContext] = useState(stringParam(project, "targetOrganizationNotes") || stringParam(project, "targetOrganizationContext"));
  const [talkingPoints, setTalkingPoints] = useState(stringParam(project, "talkingPoints") || stringParam(project, "partnershipContext"));
  const [peopleContext, setPeopleContext] = useState(stringParam(project, "targetPeopleContext"));
  const [networkingContext, setNetworkingContext] = useState(stringParam(project, "networkingContext"));
  const [notes, setNotes] = useState(stringParam(project, "notes"));
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function toggle(current: string[], value: string, update: (next: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function buildParameters(selectedType: ProjectType) {
    if (selectedType === "JOB_SEARCH") return {
      schemaVersion: 1,
      targetRoles: splitList(targetRoles),
      keywords: splitList(keywords),
      locationText,
      arrangements,
      minimumCompensation: minimumCompensation ? Number(minimumCompensation) : null,
      seniority
    };
    if (selectedType === "BUSINESS_OUTREACH") return { schemaVersion: 1, targetOrganizationNotes: organizationContext, targetContactRoles: splitList(targetRoles), talkingPoints };
    if (selectedType === "PARTNERSHIP") return { schemaVersion: 1, targetOrganizationContext: organizationContext, targetRoles: splitList(targetRoles), partnershipContext: talkingPoints };
    if (selectedType === "NETWORKING") return { schemaVersion: 1, targetPeopleContext: peopleContext, networkingContext };
    return { schemaVersion: 1, notes };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    setStatus("saving"); setError(null);
    const payload = { name, objective, defaultMailAccountId: identityId, parameters: buildParameters(type) };
    try {
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(project ? { kind: "details", payload } : { type, ...payload })
      });
      const result = await response.json() as { error?: string; projectId?: string };
      if (!response.ok) throw new Error(result.error || "The Project could not be saved.");
      router.push(`/app/projects/${project?.id ?? result.projectId}`);
      router.refresh();
    } catch (cause) {
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "The Project could not be saved.");
    }
  }

  if (!type) return <section>
    <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">New Project</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">What are you working on?</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Choose the context that fits the work. Shared mail tools remain available in every Project.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {choices.map((choice) => { const Icon = choice.icon; return <button key={choice.type} type="button" onClick={() => setType(choice.type)} className="group rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 text-left shadow-[0_14px_42px_rgba(24,58,90,.06)] transition hover:-translate-y-0.5 hover:border-[#E7B8C1] hover:shadow-[0_18px_48px_rgba(24,58,90,.1)]">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]"><Icon className="size-5" /></span>
        <h2 className="mt-5 text-lg font-semibold text-[#183A5A]">{projectTypeLabels[choice.type]}</h2>
        <p className="mt-2 text-sm leading-6 text-[#64748B]">{choice.description}</p>
      </button>; })}
    </div>
  </section>;

  const selectedIdentityAvailable = availableIdentities.some((identity) => identity.id === identityId);
  return <form onSubmit={submit} className="mx-auto max-w-4xl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">{project ? "Edit Project" : projectTypeLabels[type]}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">{project ? project.name : "Project details"}</h1></div>
      {!project && <button type="button" onClick={() => setType(null)} className="rounded-full border border-[#E8E2E3] px-4 py-2 text-sm font-semibold text-[#183A5A] hover:bg-[#FFF3F4]">Change type</button>}
    </div>
    <div className="glass mt-7 grid gap-6 rounded-3xl p-5 sm:p-8">
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Project name<input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} /></label>
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Objective<textarea className={fieldClass} value={objective} onChange={(event) => setObjective(event.target.value)} required minLength={2} maxLength={1000} rows={3} /></label>

      {type === "JOB_SEARCH" && <>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target roles <span className="font-normal text-[#64748B]">One per line or separated by commas</span><textarea className={fieldClass} value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} required rows={4} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Keywords / skills <span className="font-normal text-[#64748B]">One per line or separated by commas</span><textarea className={fieldClass} value={keywords} onChange={(event) => setKeywords(event.target.value)} required rows={4} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Location<input className={fieldClass} value={locationText} onChange={(event) => setLocationText(event.target.value)} maxLength={200} placeholder="City, state, region, or flexible" /></label>
        <fieldset><legend className="text-sm font-semibold text-[#183A5A]">Work arrangement</legend><div className="mt-3 flex flex-wrap gap-2">{[["REMOTE", "Remote"], ["HYBRID", "Hybrid"], ["ONSITE", "Onsite"]].map(([value, label]) => <label key={value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${arrangements.includes(value) ? "border-[#D95B72] bg-[#FFF3F4] text-[#A73D52]" : "border-[#E8E2E3] text-[#64748B]"}`}><input type="checkbox" className="sr-only" checked={arrangements.includes(value)} onChange={() => toggle(arrangements, value, setArrangements)} />{label}</label>)}</div></fieldset>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Minimum target compensation <span className="font-normal text-[#64748B]">Optional annual amount</span><input className={fieldClass} value={minimumCompensation} onChange={(event) => setMinimumCompensation(event.target.value)} type="number" min="1000" max="10000000" step="1000" inputMode="numeric" /></label>
        <fieldset><legend className="text-sm font-semibold text-[#183A5A]">Seniority</legend><div className="mt-3 flex flex-wrap gap-2">{[["MANAGER", "Manager"], ["SENIOR_MANAGER", "Senior Manager"], ["DIRECTOR", "Director"], ["SENIOR_DIRECTOR", "Senior Director"], ["VP", "VP"], ["C_SUITE", "C-Suite"]].map(([value, label]) => <label key={value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${seniority.includes(value) ? "border-[#D95B72] bg-[#FFF3F4] text-[#A73D52]" : "border-[#E8E2E3] text-[#64748B]"}`}><input type="checkbox" className="sr-only" checked={seniority.includes(value)} onChange={() => toggle(seniority, value, setSeniority)} />{label}</label>)}</div></fieldset>
      </>}

      {type === "BUSINESS_OUTREACH" && <><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target organization / industry notes<textarea className={fieldClass} value={organizationContext} onChange={(event) => setOrganizationContext(event.target.value)} required rows={4} /></label><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target contact roles<textarea className={fieldClass} value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} required rows={3} /></label><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Messaging context / approved talking points<textarea className={fieldClass} value={talkingPoints} onChange={(event) => setTalkingPoints(event.target.value)} rows={5} /></label></>}
      {type === "PARTNERSHIP" && <><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target organization / context<textarea className={fieldClass} value={organizationContext} onChange={(event) => setOrganizationContext(event.target.value)} required rows={4} /></label><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target roles<textarea className={fieldClass} value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} required rows={3} /></label><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Partnership context / talking points<textarea className={fieldClass} value={talkingPoints} onChange={(event) => setTalkingPoints(event.target.value)} required rows={5} /></label></>}
      {type === "NETWORKING" && <><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target people / role context<textarea className={fieldClass} value={peopleContext} onChange={(event) => setPeopleContext(event.target.value)} required rows={4} /></label><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Networking context<textarea className={fieldClass} value={networkingContext} onChange={(event) => setNetworkingContext(event.target.value)} required rows={5} /></label></>}
      {type === "CUSTOM" && <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Notes / context<textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} required rows={7} /></label>}

      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Default sending identity<select className={fieldClass} value={identityId} onChange={(event) => setIdentityId(event.target.value)} required><option value="">Select a verified identity</option>{availableIdentities.map((identity) => <option key={identity.id} value={identity.id}>{identity.email_address} — {identity.label}{identity.is_default ? " (default)" : ""}</option>)}</select></label>
      {!availableIdentities.length && <p role="alert" className="rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">Connect Google Mail and make a verified sender available before saving a Project.</p>}
      {project?.default_mail_account_id && !selectedIdentityAvailable && <p role="alert" className="rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">This Project’s previous default sender is unavailable. Select a verified identity before saving.</p>}
    </div>
    {error && <p role="alert" className="mt-5 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-5 py-4 text-sm font-semibold text-[#A73D52]">{error}</p>}
    <div className="mt-7 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => router.back()} className="rounded-full border border-[#E8E2E3] px-5 py-3 text-sm font-semibold text-[#183A5A]">Cancel</button><button type="submit" disabled={status === "saving" || !availableIdentities.length} className="rounded-full bg-[#D95B72] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] transition hover:bg-[#C94C64] disabled:cursor-not-allowed disabled:opacity-60">{status === "saving" ? "Saving…" : project ? "Save changes" : "Create Project"}</button></div>
  </form>;
}
