"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { BriefcaseBusiness, Building2, Handshake, Shapes, Users } from "lucide-react";
import {
  PROJECT_COMPENSATION_MAX,
  PROJECT_COMPENSATION_MIN,
  firstInvalidProjectField,
  mapProjectFieldErrors,
  parseProjectCreateInput,
  projectTypeLabels,
  seniorityLevelLabels,
  seniorityLevels,
  splitProjectList,
  workArrangementLabels,
  workArrangements,
  type ProjectFieldErrors,
  type ProjectFieldName,
  type ProjectType
} from "@/lib/projects/validation";

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
const invalidClass = "border-[#D95B72] bg-[#FFF8F8]";
const params = (project?: EditableProject) => project?.parameters ?? {};
const stringParam = (project: EditableProject | undefined, key: string) => typeof params(project)[key] === "string" ? params(project)[key] as string : "";
const listParam = (project: EditableProject | undefined, key: string) => Array.isArray(params(project)[key]) ? (params(project)[key] as string[]).join("\n") : "";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-sm font-medium text-[#A73D52]">{message}</p>;
}

function focusProjectField(node: HTMLElement | null) {
  if (!node) return;
  const target = node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement
    ? node
    : node.querySelector<HTMLElement>("input, textarea, select");
  const focusable = target ?? node;
  focusable.focus();
  focusable.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function ProjectForm({ identities, project }: { identities: ProjectIdentity[]; project?: EditableProject }) {
  const router = useRouter();
  const fieldRefs = useRef<Partial<Record<ProjectFieldName, HTMLElement | null>>>({});
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
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProjectFieldErrors>({});

  function setFieldRef(field: ProjectFieldName) {
    return (node: HTMLElement | null) => {
      fieldRefs.current[field] = node;
    };
  }

  function toggle(current: string[], value: string, update: (next: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function buildParameters(selectedType: ProjectType) {
    if (selectedType === "JOB_SEARCH") return {
      schemaVersion: 1,
      targetRoles: splitProjectList(targetRoles),
      keywords: splitProjectList(keywords),
      locationText,
      arrangements,
      minimumCompensation: minimumCompensation.trim() === "" ? null : minimumCompensation,
      seniority
    };
    if (selectedType === "BUSINESS_OUTREACH") return { schemaVersion: 1, targetOrganizationNotes: organizationContext, targetContactRoles: splitProjectList(targetRoles), talkingPoints };
    if (selectedType === "PARTNERSHIP") return { schemaVersion: 1, targetOrganizationContext: organizationContext, targetRoles: splitProjectList(targetRoles), partnershipContext: talkingPoints };
    if (selectedType === "NETWORKING") return { schemaVersion: 1, targetPeopleContext: peopleContext, networkingContext };
    return { schemaVersion: 1, notes };
  }

  function applyFieldErrors(next: ProjectFieldErrors, selectedType: ProjectType) {
    setFieldErrors(next);
    const first = firstInvalidProjectField(selectedType, next);
    if (first) window.setTimeout(() => focusProjectField(fieldRefs.current[first] ?? null), 0);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    setStatus("saving");
    setFormError(null);
    setFieldErrors({});
    const payload = { type, name, objective, defaultMailAccountId: identityId, parameters: buildParameters(type) };
    try {
      parseProjectCreateInput(payload);
    } catch (cause) {
      setStatus("idle");
      if (cause instanceof z.ZodError) {
        applyFieldErrors(mapProjectFieldErrors(cause), type);
        return;
      }
      setFormError("The Project could not be saved.");
      return;
    }
    try {
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(project ? { kind: "details", payload: { name: payload.name, objective: payload.objective, defaultMailAccountId: payload.defaultMailAccountId, parameters: payload.parameters } } : payload)
      });
      const result = await response.json() as { error?: string; fieldErrors?: ProjectFieldErrors; projectId?: string };
      if (!response.ok) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
          setStatus("idle");
          applyFieldErrors(result.fieldErrors, type);
          return;
        }
        throw new Error(result.error || "The Project could not be saved.");
      }
      router.push(`/app/projects/${project?.id ?? result.projectId}`);
      router.refresh();
    } catch (cause) {
      setStatus("idle");
      setFormError(cause instanceof Error ? cause.message : "The Project could not be saved.");
    }
  }

  if (!type) return <section>
    <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">New Project</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">What are you working on?</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Choose the context that fits the work. Shared mail tools remain available in every Project.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {choices.map((choice) => {
        const Icon = choice.icon;
        return <button key={choice.type} type="button" onClick={() => setType(choice.type)} className="group rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 text-left shadow-[0_14px_42px_rgba(24,58,90,.06)] transition hover:-translate-y-0.5 hover:border-[#E7B8C1] hover:shadow-[0_18px_48px_rgba(24,58,90,.1)]">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]"><Icon className="size-5" /></span>
          <h2 className="mt-5 text-lg font-semibold text-[#183A5A]">{projectTypeLabels[choice.type]}</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">{choice.description}</p>
        </button>;
      })}
    </div>
  </section>;

  const selectedIdentityAvailable = availableIdentities.some((identity) => identity.id === identityId);
  const controlClass = (field: ProjectFieldName) => `${fieldClass} ${fieldErrors[field] ? invalidClass : ""}`;

  return <form noValidate onSubmit={submit} className="mx-auto max-w-4xl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">{project ? "Edit Project" : projectTypeLabels[type]}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">{project ? project.name : "Project details"}</h1>
      </div>
      {!project && <button type="button" onClick={() => { setType(null); setFieldErrors({}); setFormError(null); }} className="rounded-full border border-[#E8E2E3] px-4 py-2 text-sm font-semibold text-[#183A5A] hover:bg-[#FFF3F4]">Change type</button>}
    </div>
    <div className="glass mt-7 grid gap-6 rounded-3xl p-5 sm:p-8">
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
        Project name
        <input ref={setFieldRef("name")} className={controlClass("name")} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "project-name-error" : undefined} />
        <FieldError id="project-name-error" message={fieldErrors.name} />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
        Objective
        <textarea ref={setFieldRef("objective")} className={controlClass("objective")} value={objective} onChange={(event) => setObjective(event.target.value)} required minLength={2} maxLength={1000} rows={3} aria-invalid={Boolean(fieldErrors.objective)} aria-describedby={fieldErrors.objective ? "project-objective-error" : undefined} />
        <FieldError id="project-objective-error" message={fieldErrors.objective} />
      </label>

      {type === "JOB_SEARCH" && <>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
          Target roles <span className="font-normal text-[#64748B]">One per line or separated by commas</span>
          <textarea ref={setFieldRef("targetRoles")} className={controlClass("targetRoles")} value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} required rows={4} aria-invalid={Boolean(fieldErrors.targetRoles)} aria-describedby={fieldErrors.targetRoles ? "project-roles-error" : undefined} />
          <FieldError id="project-roles-error" message={fieldErrors.targetRoles} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
          Keywords / skills <span className="font-normal text-[#64748B]">One per line or separated by commas</span>
          <textarea ref={setFieldRef("keywords")} className={controlClass("keywords")} value={keywords} onChange={(event) => setKeywords(event.target.value)} required rows={4} aria-invalid={Boolean(fieldErrors.keywords)} aria-describedby={fieldErrors.keywords ? "project-keywords-error" : undefined} />
          <FieldError id="project-keywords-error" message={fieldErrors.keywords} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
          Location
          <input ref={setFieldRef("locationText")} className={controlClass("locationText")} value={locationText} onChange={(event) => setLocationText(event.target.value)} maxLength={200} placeholder="City, state, region, or flexible" aria-invalid={Boolean(fieldErrors.locationText)} aria-describedby={fieldErrors.locationText ? "project-location-error" : undefined} />
          <FieldError id="project-location-error" message={fieldErrors.locationText} />
        </label>
        <fieldset ref={setFieldRef("arrangements")} tabIndex={-1} className={`rounded-2xl border p-4 ${fieldErrors.arrangements ? "border-[#D95B72] bg-[#FFF8F8]" : "border-transparent"}`} aria-describedby={fieldErrors.arrangements ? "project-arrangements-error" : undefined}>
          <legend className="text-sm font-semibold text-[#183A5A]">Work arrangement <span className="font-normal text-[#64748B]">(required)</span></legend>
          <p className="mt-1 text-sm font-normal text-[#64748B]">Select every arrangement this search should include.</p>
          <div className="mt-3 flex flex-wrap gap-2">{workArrangements.map((value) => <label key={value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${arrangements.includes(value) ? "border-[#D95B72] bg-[#FFF3F4] text-[#A73D52]" : "border-[#E8E2E3] text-[#64748B]"}`}><input type="checkbox" className="sr-only" checked={arrangements.includes(value)} onChange={() => toggle(arrangements, value, setArrangements)} aria-invalid={Boolean(fieldErrors.arrangements)} aria-describedby={fieldErrors.arrangements ? "project-arrangements-error" : undefined} />{workArrangementLabels[value]}</label>)}</div>
          <FieldError id="project-arrangements-error" message={fieldErrors.arrangements} />
        </fieldset>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
          Target Annual Compensation
          <span className="font-normal text-[#64748B]">Optional. Enter your desired annual base compensation in whole U.S. dollars, or leave this blank.</span>
          <input ref={setFieldRef("minimumCompensation")} className={controlClass("minimumCompensation")} value={minimumCompensation} onChange={(event) => setMinimumCompensation(event.target.value)} type="number" min={PROJECT_COMPENSATION_MIN} max={PROJECT_COMPENSATION_MAX} step="1" inputMode="numeric" aria-invalid={Boolean(fieldErrors.minimumCompensation)} aria-describedby={fieldErrors.minimumCompensation ? "project-compensation-error" : "project-compensation-help"} />
          <p id="project-compensation-help" className="text-xs font-normal leading-5 text-[#64748B]">This is a minimum annual amount used as search context. It is not required.</p>
          <FieldError id="project-compensation-error" message={fieldErrors.minimumCompensation} />
        </label>
        <fieldset ref={setFieldRef("seniority")} tabIndex={-1} className={`rounded-2xl border p-4 ${fieldErrors.seniority ? "border-[#D95B72] bg-[#FFF8F8]" : "border-transparent"}`} aria-describedby={fieldErrors.seniority ? "project-seniority-error" : undefined}>
          <legend className="text-sm font-semibold text-[#183A5A]">Seniority <span className="font-normal text-[#64748B]">(required)</span></legend>
          <p className="mt-1 text-sm font-normal text-[#64748B]">Select at least one seniority level for this search.</p>
          <div className="mt-3 flex flex-wrap gap-2">{seniorityLevels.map((value) => <label key={value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${seniority.includes(value) ? "border-[#D95B72] bg-[#FFF3F4] text-[#A73D52]" : "border-[#E8E2E3] text-[#64748B]"}`}><input type="checkbox" className="sr-only" checked={seniority.includes(value)} onChange={() => toggle(seniority, value, setSeniority)} aria-invalid={Boolean(fieldErrors.seniority)} aria-describedby={fieldErrors.seniority ? "project-seniority-error" : undefined} />{seniorityLevelLabels[value]}</label>)}</div>
          <FieldError id="project-seniority-error" message={fieldErrors.seniority} />
        </fieldset>
      </>}

      {type === "BUSINESS_OUTREACH" && <>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target organization / industry notes<textarea ref={setFieldRef("organizationContext")} className={controlClass("organizationContext")} value={organizationContext} onChange={(event) => setOrganizationContext(event.target.value)} required rows={4} aria-invalid={Boolean(fieldErrors.organizationContext)} aria-describedby={fieldErrors.organizationContext ? "project-org-error" : undefined} /><FieldError id="project-org-error" message={fieldErrors.organizationContext} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target contact roles<textarea ref={setFieldRef("targetRoles")} className={controlClass("targetRoles")} value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} required rows={3} aria-invalid={Boolean(fieldErrors.targetRoles)} aria-describedby={fieldErrors.targetRoles ? "project-contact-roles-error" : undefined} /><FieldError id="project-contact-roles-error" message={fieldErrors.targetRoles} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Messaging context / approved talking points<textarea ref={setFieldRef("talkingPoints")} className={controlClass("talkingPoints")} value={talkingPoints} onChange={(event) => setTalkingPoints(event.target.value)} rows={5} aria-invalid={Boolean(fieldErrors.talkingPoints)} aria-describedby={fieldErrors.talkingPoints ? "project-talking-error" : undefined} /><FieldError id="project-talking-error" message={fieldErrors.talkingPoints} /></label>
      </>}
      {type === "PARTNERSHIP" && <>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target organization / context<textarea ref={setFieldRef("organizationContext")} className={controlClass("organizationContext")} value={organizationContext} onChange={(event) => setOrganizationContext(event.target.value)} required rows={4} aria-invalid={Boolean(fieldErrors.organizationContext)} aria-describedby={fieldErrors.organizationContext ? "project-org-error" : undefined} /><FieldError id="project-org-error" message={fieldErrors.organizationContext} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target roles<textarea ref={setFieldRef("targetRoles")} className={controlClass("targetRoles")} value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} required rows={3} aria-invalid={Boolean(fieldErrors.targetRoles)} aria-describedby={fieldErrors.targetRoles ? "project-roles-error" : undefined} /><FieldError id="project-roles-error" message={fieldErrors.targetRoles} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Partnership context / talking points<textarea ref={setFieldRef("talkingPoints")} className={controlClass("talkingPoints")} value={talkingPoints} onChange={(event) => setTalkingPoints(event.target.value)} required rows={5} aria-invalid={Boolean(fieldErrors.talkingPoints)} aria-describedby={fieldErrors.talkingPoints ? "project-talking-error" : undefined} /><FieldError id="project-talking-error" message={fieldErrors.talkingPoints} /></label>
      </>}
      {type === "NETWORKING" && <>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Target people / role context<textarea ref={setFieldRef("peopleContext")} className={controlClass("peopleContext")} value={peopleContext} onChange={(event) => setPeopleContext(event.target.value)} required rows={4} aria-invalid={Boolean(fieldErrors.peopleContext)} aria-describedby={fieldErrors.peopleContext ? "project-people-error" : undefined} /><FieldError id="project-people-error" message={fieldErrors.peopleContext} /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Networking context<textarea ref={setFieldRef("networkingContext")} className={controlClass("networkingContext")} value={networkingContext} onChange={(event) => setNetworkingContext(event.target.value)} required rows={5} aria-invalid={Boolean(fieldErrors.networkingContext)} aria-describedby={fieldErrors.networkingContext ? "project-network-error" : undefined} /><FieldError id="project-network-error" message={fieldErrors.networkingContext} /></label>
      </>}
      {type === "CUSTOM" && <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Notes / context<textarea ref={setFieldRef("notes")} className={controlClass("notes")} value={notes} onChange={(event) => setNotes(event.target.value)} required rows={7} aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={fieldErrors.notes ? "project-notes-error" : undefined} /><FieldError id="project-notes-error" message={fieldErrors.notes} /></label>}

      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">
        Default sending identity
        <select ref={setFieldRef("defaultMailAccountId")} className={controlClass("defaultMailAccountId")} value={identityId} onChange={(event) => setIdentityId(event.target.value)} required aria-invalid={Boolean(fieldErrors.defaultMailAccountId)} aria-describedby={fieldErrors.defaultMailAccountId ? "project-identity-error" : undefined}>
          <option value="">Select a verified identity</option>
          {availableIdentities.map((identity) => <option key={identity.id} value={identity.id}>{identity.email_address} — {identity.label}{identity.is_default ? " (default)" : ""}</option>)}
        </select>
        <FieldError id="project-identity-error" message={fieldErrors.defaultMailAccountId} />
      </label>
      {!availableIdentities.length && <p role="alert" className="rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">Connect Google Mail and make a verified sender available before saving a Project.</p>}
      {project?.default_mail_account_id && !selectedIdentityAvailable && <p role="alert" className="rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">This Project’s previous default sender is unavailable. Select a verified identity before saving.</p>}
    </div>
    {formError && <p role="alert" className="mt-5 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-5 py-4 text-sm font-semibold text-[#A73D52]">{formError}</p>}
    <div className="mt-7 flex flex-wrap justify-end gap-3">
      <button type="button" onClick={() => router.back()} className="rounded-full border border-[#E8E2E3] px-5 py-3 text-sm font-semibold text-[#183A5A]">Cancel</button>
      <button type="submit" disabled={status === "saving" || !availableIdentities.length} className="rounded-full bg-[#D95B72] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] transition hover:bg-[#C94C64] disabled:cursor-not-allowed disabled:opacity-60">{status === "saving" ? "Saving…" : project ? "Save changes" : "Create Project"}</button>
    </div>
  </form>;
}
