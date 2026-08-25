import { redirect } from "next/navigation";
import { BadgeCheck, BookOpenCheck, Building2, Database, GraduationCap, Layers3, MapPin, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Master Career Profile" };

type Organization = { id: string; canonical_name: string };
type Title = { id: string; canonical_name: string };
type Experience = { id: string; canonical_key: string; organization_id: string; client_organization_id: string | null; title_id: string | null; start_date: string | null; start_precision: "MONTH" | "YEAR" | "UNKNOWN"; end_date: string | null; end_precision: "MONTH" | "YEAR" | "UNKNOWN"; is_current: boolean; summary: string | null; completeness: "COMPLETE" | "PARTIAL"; authority_status: string };
type Project = { id: string; canonical_key: string; canonical_name: string; project_kind: string; summary: string; impact: string | null; authority_status: string };
type Accomplishment = { id: string; experience_id: string | null; project_id: string | null; statement: string };
type Metric = { id: string; accomplishment_id: string; value_numeric: number | null; value_text: string | null; before_numeric: number | null; before_text: string | null; after_numeric: number | null; after_text: string | null; unit: string | null; qualifier: string | null };

function formatCareerDate(value: string | null, precision: Experience["start_precision"], current = false) {
  if (current) return "Present";
  if (!value) return "Date not provided";
  return new Intl.DateTimeFormat("en-US", { ...(precision === "MONTH" ? { month: "short" as const } : {}), year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatMetric(metric: Metric) {
  const format = (value: number | null, text: string | null) => value === null ? text : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  if (metric.before_numeric !== null || metric.before_text) return `${format(metric.before_numeric, metric.before_text)} → ${format(metric.after_numeric, metric.after_text)}`;
  const value = format(metric.value_numeric, metric.value_text);
  const unit = metric.unit ? ` ${metric.unit.toLowerCase().replaceAll("_", " ")}` : "";
  return `${metric.qualifier === "MINIMUM" ? "At least " : metric.qualifier === "UNDER" ? "Under " : ""}${value ?? ""}${unit}`;
}

export default async function CareerProfilePage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const database = owner.database;
  const ownerId = owner.user.id;
  const [profileResult, organizationsResult, titlesResult, experiencesResult, educationResult, credentialsResult, skillsResult, projectsResult, accomplishmentsResult, metricsResult, aliasesResult, sourcesResult, provenanceResult] = await Promise.all([
    database.from("career_profiles").select("full_name, professional_headline, location_text, professional_summary, years_experience_claim, authority_status, updated_at").eq("owner_id", ownerId).maybeSingle(),
    database.from("career_organizations").select("id, canonical_name").eq("owner_id", ownerId),
    database.from("career_titles").select("id, canonical_name").eq("owner_id", ownerId),
    database.from("career_experiences").select("id, canonical_key, organization_id, client_organization_id, title_id, start_date, start_precision, end_date, end_precision, is_current, summary, completeness, authority_status").eq("owner_id", ownerId).order("start_date", { ascending: false, nullsFirst: false }),
    database.from("career_education").select("id, degree_name, field_of_study, institution_name, authority_status").eq("owner_id", ownerId),
    database.from("career_credentials").select("id, credential_name, credential_status, authority_status").eq("owner_id", ownerId),
    database.from("career_skills").select("id, canonical_name, category, authority_status").eq("owner_id", ownerId).order("canonical_name"),
    database.from("career_projects").select("id, canonical_key, canonical_name, project_kind, summary, impact, authority_status").eq("owner_id", ownerId).order("canonical_name"),
    database.from("career_accomplishments").select("id, experience_id, project_id, statement").eq("owner_id", ownerId),
    database.from("career_metrics").select("id, accomplishment_id, value_numeric, value_text, before_numeric, before_text, after_numeric, after_text, unit, qualifier").eq("owner_id", ownerId),
    database.from("career_aliases").select("entity_type, entity_id, alias_text").eq("owner_id", ownerId),
    database.from("career_sources").select("id, label, authority_status").eq("owner_id", ownerId).order("reviewed_at"),
    database.from("career_provenance").select("id", { count: "exact", head: true }).eq("owner_id", ownerId),
  ]);
  const failed = [profileResult, organizationsResult, titlesResult, experiencesResult, educationResult, credentialsResult, skillsResult, projectsResult, accomplishmentsResult, metricsResult, aliasesResult, sourcesResult, provenanceResult].some((result) => result.error);
  if (failed) throw new Error("CAREER_PROFILE_UNAVAILABLE");
  if (!profileResult.data) throw new Error("CAREER_PROFILE_NOT_IMPORTED");

  const profile = profileResult.data;
  const organizations = (organizationsResult.data ?? []) as Organization[];
  const titles = (titlesResult.data ?? []) as Title[];
  const experiences = (experiencesResult.data ?? []) as Experience[];
  const projects = (projectsResult.data ?? []) as Project[];
  const accomplishments = (accomplishmentsResult.data ?? []) as Accomplishment[];
  const metrics = (metricsResult.data ?? []) as Metric[];
  const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.canonical_name]));
  const titleNames = new Map(titles.map((title) => [title.id, title.canonical_name]));
  const aliases = aliasesResult.data ?? [];
  const skillsByCategory = Map.groupBy(skillsResult.data ?? [], (skill) => skill.category as string);

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="career">
    <div className="mx-auto max-w-6xl">
      <header className="rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] p-7 shadow-[0_18px_54px_rgba(24,58,90,.08)] sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Authoritative career data layer</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#183A5A] sm:text-5xl">{profile.full_name}</h1><p className="mt-3 text-lg font-semibold text-[#A73D52]">{profile.professional_headline}</p>{profile.location_text && <p className="mt-3 flex items-center gap-2 text-sm text-[#64748B]"><MapPin className="size-4 text-[#D95B72]" />{profile.location_text}</p>}</div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#F7DDE1] px-4 py-2 text-xs font-semibold uppercase tracking-[.1em] text-[#A73D52]"><BadgeCheck className="size-4" /> Resolved profile</span>
        </div>
        <p className="mt-7 max-w-4xl text-sm leading-7 text-[#52657A]">{profile.professional_summary}</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-4">
          {[{ label: "Experience", value: profile.years_experience_claim ?? "Verified", icon: Building2 }, { label: "Career records", value: experiences.length, icon: Layers3 }, { label: "Canonical projects", value: projects.length, icon: Sparkles }, { label: "Provenance facts", value: provenanceResult.count ?? 0, icon: Database }].map((stat) => <div key={stat.label} className="rounded-2xl bg-[#FFF3F4] p-4"><stat.icon className="size-4 text-[#D95B72]" /><p className="mt-3 text-2xl font-semibold text-[#183A5A]">{stat.value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[.08em] text-[#64748B]">{stat.label}</p></div>)}
        </div>
      </header>

      <section className="mt-8"><div className="flex items-center gap-3"><Building2 className="size-5 text-[#D95B72]" /><h2 className="text-2xl font-semibold tracking-[-.03em] text-[#183A5A]">Experience</h2></div><div className="mt-4 space-y-4">{experiences.map((experience) => <article key={experience.id} className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 shadow-[0_12px_36px_rgba(24,58,90,.05)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-[#183A5A]">{experience.title_id ? titleNames.get(experience.title_id) : "Earlier finance/accounting leadership"}</h3><p className="mt-1 text-sm font-semibold text-[#A73D52]">{organizationNames.get(experience.organization_id)}{experience.client_organization_id ? ` · Client: ${organizationNames.get(experience.client_organization_id)}` : ""}</p></div><p className="text-sm font-semibold text-[#64748B]">{formatCareerDate(experience.start_date, experience.start_precision)} — {formatCareerDate(experience.end_date, experience.end_precision, experience.is_current)}</p></div>{experience.summary && <p className="mt-4 text-sm leading-6 text-[#64748B]">{experience.summary}</p>}<ul className="mt-4 grid gap-2 md:grid-cols-2">{accomplishments.filter((value) => value.experience_id === experience.id).map((value) => <li key={value.id} className="flex gap-2 text-sm leading-6 text-[#52657A]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#D95B72]" />{value.statement}</li>)}</ul>{experience.completeness === "PARTIAL" && <p className="mt-4 text-xs font-semibold uppercase tracking-[.08em] text-[#8A6A71]">Source-limited partial record · no dates or title inferred</p>}</article>)}</div></section>

      <section className="mt-8"><div className="flex items-center gap-3"><Sparkles className="size-5 text-[#D95B72]" /><h2 className="text-2xl font-semibold tracking-[-.03em] text-[#183A5A]">Canonical projects</h2></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{projects.map((project) => { const projectAliases = aliases.filter((alias) => alias.entity_type === "PROJECT" && alias.entity_id === project.id); return <article key={project.id} className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-[#183A5A]">{project.canonical_name}</h3><span className="rounded-full bg-[#F7DDE1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#A73D52]">{project.project_kind.replaceAll("_", " ")}</span></div>{projectAliases.length > 0 && <p className="mt-2 text-xs text-[#64748B]">Also sourced as: {projectAliases.map((alias) => alias.alias_text).join(", ")}</p>}<p className="mt-4 text-sm leading-6 text-[#64748B]">{project.summary}</p>{project.impact && <p className="mt-4 rounded-2xl bg-[#FFF3F4] p-4 text-sm leading-6 text-[#52657A]"><span className="font-semibold text-[#A73D52]">Impact: </span>{project.impact}</p>}<ul className="mt-4 space-y-2">{accomplishments.filter((value) => value.project_id === project.id).map((value) => <li key={value.id} className="text-sm text-[#52657A]">{value.statement}</li>)}</ul></article>; })}</div></section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6"><div className="flex items-center gap-3"><BookOpenCheck className="size-5 text-[#D95B72]" /><h2 className="text-xl font-semibold text-[#183A5A]">Expertise</h2></div><div className="mt-5 space-y-5">{Array.from(skillsByCategory.entries()).map(([category, skills]) => <div key={category}><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#A73D52]">{category}</p><div className="mt-2 flex flex-wrap gap-2">{skills.map((skill) => <span key={skill.id} className="rounded-full border border-[#E8E2E3] bg-[#FFF3F4]/60 px-3 py-1.5 text-xs font-semibold text-[#52657A]">{skill.canonical_name}</span>)}</div></div>)}</div></section>
        <div className="space-y-6"><section className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6"><div className="flex items-center gap-3"><GraduationCap className="size-5 text-[#D95B72]" /><h2 className="text-xl font-semibold text-[#183A5A]">Education & credentials</h2></div><div className="mt-5 space-y-4">{(educationResult.data ?? []).map((item) => <div key={item.id}><p className="font-semibold text-[#183A5A]">{item.degree_name}{item.field_of_study ? ` in ${item.field_of_study}` : ""}</p><p className="mt-1 text-sm text-[#64748B]">{item.institution_name}</p></div>)}{(credentialsResult.data ?? []).map((item) => <div key={item.id} className="rounded-2xl bg-[#FFF3F4] p-4"><p className="font-semibold text-[#183A5A]">{item.credential_name}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[.1em] text-[#A73D52]">{item.credential_status}</p></div>)}</div></section>
          <section className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6"><div className="flex items-center gap-3"><Database className="size-5 text-[#D95B72]" /><h2 className="text-xl font-semibold text-[#183A5A]">Quantified evidence</h2></div><div className="mt-5 space-y-3">{metrics.map((metric) => { const accomplishment = accomplishments.find((value) => value.id === metric.accomplishment_id); return <div key={metric.id} className="rounded-2xl bg-[#FFF3F4] p-4"><p className="text-lg font-semibold text-[#A73D52]">{formatMetric(metric)}</p><p className="mt-1 text-sm leading-5 text-[#64748B]">{accomplishment?.statement}</p></div>; })}</div></section>
        </div>
      </div>

      <footer className="mt-8 rounded-3xl border border-[#E8E2E3] bg-[#183A5A] p-6 text-white"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-[#F3A0A0]" /><div><h2 className="font-semibold">Source integrity</h2><p className="mt-2 text-sm leading-6 text-white/65">This read-only profile is backed by {sourcesResult.data?.length ?? 0} reviewed sources and {provenanceResult.count ?? 0} field-level provenance records. KF Resume controls employment dates and exact titles; owner-confirmed resolutions control education, client context, project canonicalization, and current credential status.</p></div></div></footer>
    </div>
  </AppShell>;
}
