"use client";

import { useState, type CSSProperties } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { formatResumeDate } from "@/lib/resumes/format";
import type { TargetResumeContent } from "@/lib/resumes/target/types";

const layouts = [
  { id: "classic", name: "Classic", note: "Single column. The layout employers and applicant systems expect." },
  { id: "sidebar", name: "Sidebar", note: "Experience on the page, with skills and education in a rail." },
  { id: "executive", name: "Executive", note: "A wider header and a longer profile, still in résumé order." },
  { id: "compact", name: "Compact", note: "Tighter type when the story needs to fit on one page." }
] as const;

const palettes = [
  { id: "ink", name: "Ink", paper: "#FFFFFF", ink: "#111827", muted: "#4B5563", accent: "#111827", heading: "#111827", bandText: "#FFFFFF" },
  { id: "navy", name: "Navy", paper: "#FFFFFF", ink: "#1E293B", muted: "#475569", accent: "#1E3A5F", heading: "#1E3A5F", bandText: "#F8FAFC" },
  { id: "forest", name: "Forest", paper: "#FFFFFF", ink: "#14261C", muted: "#3D5348", accent: "#1B4332", heading: "#1B4332", bandText: "#F4FBF7" },
  { id: "wine", name: "Wine", paper: "#FFFCF8", ink: "#2C1810", muted: "#6B5344", accent: "#7A3048", heading: "#7A3048", bandText: "#FFF8F4" }
] as const;

const fonts = [
  { id: "modern", name: "Modern", body: "var(--font-inter), Inter, sans-serif", heading: "var(--font-montserrat), Montserrat, sans-serif" },
  { id: "traditional", name: "Traditional", body: "var(--font-source-serif), 'Source Serif 4', Georgia, serif", heading: "var(--font-source-serif), 'Source Serif 4', Georgia, serif" },
  { id: "editorial", name: "Editorial", body: "var(--font-inter), Inter, sans-serif", heading: "var(--font-libre), 'Libre Baskerville', Georgia, serif" }
] as const;

const headers = [
  { id: "rule", name: "Rule" },
  { id: "center", name: "Centered" },
  { id: "band", name: "Band" },
  { id: "split", name: "Split" }
] as const;

type LayoutId = (typeof layouts)[number]["id"];
type Palette = (typeof palettes)[number];
type FontChoice = (typeof fonts)[number];
type HeaderId = (typeof headers)[number]["id"];

function dates(item: TargetResumeContent["experiences"][number]) {
  return `${formatResumeDate(item.startDate, item.startPrecision)} – ${formatResumeDate(item.endDate, item.endPrecision, item.isCurrent)}`;
}

function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function paperVars(palette: Palette, font: FontChoice): CSSProperties {
  return {
    "--resume-ink": palette.ink,
    "--resume-paper": palette.paper,
    "--resume-muted": palette.muted,
    "--resume-accent": palette.accent,
    "--resume-heading": palette.heading,
    "--resume-band-text": palette.bandText,
    "--resume-body": font.body,
    "--resume-heading-font": font.heading
  } as CSSProperties;
}

function ExperienceBlock({ content, compact = false }: { content: TargetResumeContent; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {content.experiences.map((experience) => (
        <section key={experience.experienceId}>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className={compact ? "text-sm font-semibold" : "text-[15px] font-semibold"}>{experience.title ?? "Role"}</h3>
            <p className="resume-muted shrink-0 text-xs">{dates(experience)}</p>
          </div>
          <p className="resume-muted text-sm">{experience.employer}{experience.client ? ` · ${experience.client}` : ""}{experience.location ? ` · ${experience.location}` : ""}</p>
          <ul className={`mt-1.5 list-disc space-y-1 pl-4 ${compact ? "text-xs leading-5" : "text-sm leading-6"}`}>
            {experience.bullets.map((bullet, index) => <li key={`${experience.experienceId}-${index}`}>{bullet}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <h2 className="resume-rule border-b pb-1 text-[11px] font-semibold uppercase tracking-[.16em]">{children}</h2>;
}

function linkedinLabel(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function contactItems(candidate: TargetResumeContent["candidate"]) {
  return [
    candidate.email ? { key: "email", href: `mailto:${candidate.email}`, label: candidate.email } : null,
    candidate.phone ? { key: "phone", href: `tel:${candidate.phone.replace(/[^\d+]/g, "")}`, label: candidate.phone } : null,
    candidate.linkedin ? { key: "linkedin", href: candidate.linkedin, label: linkedinLabel(candidate.linkedin) } : null
  ].filter((item): item is { key: string; href: string; label: string } => Boolean(item));
}

function ContactLine({ candidate, stacked = false }: { candidate: TargetResumeContent["candidate"]; stacked?: boolean }) {
  const items = contactItems(candidate);
  if (!items.length) return null;
  if (stacked) {
    return (
      <ul className="mt-3 space-y-1 text-[11px] leading-4">
        {items.map((item) => <li key={item.key}><a className="text-inherit underline-offset-2 hover:underline" href={item.href}>{item.key === "linkedin" ? item.label.split("/").map((part, index) => <span key={`${item.key}-${index}`}>{index > 0 && <>/<wbr /></>}{part}</span>) : item.label}</a></li>)}
      </ul>
    );
  }
  return (
    <p className="resume-muted mt-2 text-xs">
      {items.map((item, index) => (
        <span key={item.key}>
          {index > 0 && " · "}
          <a className="text-inherit underline-offset-2 hover:underline" href={item.href}>{item.label}</a>
        </span>
      ))}
    </p>
  );
}

function PaperHeader({ content, header, compact = false }: { content: TargetResumeContent; header: HeaderId; compact?: boolean }) {
  const meta = [content.target.jobTitle, content.candidate.location].filter(Boolean).join(" · ");
  const nameClass = compact ? "text-2xl font-semibold tracking-[-.03em]" : "text-3xl font-semibold tracking-[-.03em]";
  if (header === "band") {
    return (
      <header className="resume-band px-8 py-8 sm:px-12">
        <h1 className={nameClass}>{content.candidate.fullName}</h1>
        <p className="mt-2 text-sm">{content.candidate.headline}</p>
        <ContactLine candidate={content.candidate} />
        <p className="mt-2 text-xs opacity-80">{meta} · {content.target.employer}</p>
      </header>
    );
  }
  if (header === "center") {
    return (
      <header className="resume-rule border-b-2 px-8 pb-4 pt-10 text-center sm:px-12">
        <h1 className={nameClass}>{content.candidate.fullName}</h1>
        <p className="mt-2 text-sm">{content.candidate.headline}</p>
        <ContactLine candidate={content.candidate} />
        <p className="resume-muted mt-2 text-xs">{meta}</p>
        <p className="resume-muted mt-1 text-xs">{content.target.employer}</p>
      </header>
    );
  }
  if (header === "split") {
    return (
      <header className="resume-rule flex flex-col gap-3 border-b-2 px-8 pb-4 pt-10 sm:flex-row sm:items-end sm:justify-between sm:px-12">
        <div>
          <h1 className={nameClass}>{content.candidate.fullName}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6">{content.candidate.headline}</p>
          <ContactLine candidate={content.candidate} />
        </div>
        <p className="resume-muted text-right text-xs uppercase tracking-[.12em]">{content.target.jobTitle}<br />{content.candidate.location}<br />{content.target.employer}</p>
      </header>
    );
  }
  return (
    <header className="resume-rule border-b-2 px-8 pb-4 pt-10 sm:px-12">
      <h1 className={nameClass}>{content.candidate.fullName}</h1>
      <p className="mt-1 text-sm font-medium">{content.candidate.headline}</p>
      <ContactLine candidate={content.candidate} />
      <p className="resume-muted mt-2 text-xs">{meta}</p>
      <p className="resume-muted mt-1 text-xs">Tailored for {content.target.employer}</p>
    </header>
  );
}

function ClassicResume({ content, header }: { content: TargetResumeContent; header: HeaderId }) {
  return (
    <>
      <PaperHeader content={content} header={header} />
      <div className="space-y-5 px-8 py-6 sm:px-12">
        <section>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-2 text-sm leading-6">{content.summary}</p>
        </section>
        <section>
          <SectionLabel>Experience</SectionLabel>
          <div className="mt-3"><ExperienceBlock content={content} /></div>
        </section>
        {content.projects.length > 0 && (
          <section>
            <SectionLabel>Projects</SectionLabel>
            <div className="mt-3 space-y-3">
              {content.projects.map((project) => (
                <section key={project.projectId}>
                  <h3 className="text-sm font-semibold">{project.name}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-6">{project.bullets.map((bullet, index) => <li key={`${project.projectId}-${index}`}>{bullet}</li>)}</ul>
                </section>
              ))}
            </div>
          </section>
        )}
        <section>
          <SectionLabel>Skills</SectionLabel>
          <div className="mt-2 space-y-1 text-sm leading-6">
            {content.skillGroups.map((group) => <p key={group.category}><span className="font-semibold">{categoryLabel(group.category)}: </span>{group.skills.map((skill) => skill.name).join(", ")}</p>)}
          </div>
        </section>
        <section>
          <SectionLabel>Education</SectionLabel>
          <div className="mt-2 space-y-2 text-sm">
            {content.education.map((item) => <p key={item.educationId}><span className="font-semibold">{item.degree}{item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""}</span> — {item.institution}</p>)}
          </div>
        </section>
        {content.credentials.length > 0 && (
          <section>
            <SectionLabel>Credentials</SectionLabel>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{content.credentials.map((item) => <li key={item.credentialId}>{item.name}</li>)}</ul>
          </section>
        )}
      </div>
    </>
  );
}

function SidebarResume({ content, header }: { content: TargetResumeContent; header: HeaderId }) {
  const nameAlign = header === "center" ? "text-center" : "text-left";
  return (
    <article className="grid md:grid-cols-[280px_minmax(0,1fr)]">
      {header === "band" && (
        <header className="resume-band px-6 py-6 md:col-span-2">
          <h1 className="text-3xl font-semibold tracking-[-.03em]">{content.candidate.fullName}</h1>
          <p className="mt-2 text-sm">{content.candidate.headline}</p>
          <ContactLine candidate={content.candidate} />
        </header>
      )}
      <aside className="resume-rail min-w-0 px-6 py-8 [hyphens:none]">
        {header !== "band" && (
          <div className={nameAlign}>
            <h1 className="text-xl font-semibold leading-snug tracking-[-.02em]">{content.candidate.fullName}</h1>
            <p className="mt-3 text-xs font-medium leading-5">{header === "split" ? content.candidate.headline : content.target.jobTitle}</p>
            <ContactLine candidate={content.candidate} stacked />
            {content.candidate.location && <p className="mt-2 text-xs leading-4 opacity-80">{content.candidate.location}</p>}
          </div>
        )}
        <h2 className={`${header === "band" ? "" : "mt-7"} border-b border-white/20 pb-1 text-[10px] font-semibold uppercase tracking-[.14em]`}>Skills</h2>
        <div className="mt-3 space-y-3 text-xs leading-5">
          {content.skillGroups.map((group) => (
            <p key={group.category}>
              <span className="font-semibold">{categoryLabel(group.category)}</span>
              <span className="mt-0.5 block">{group.skills.map((skill) => skill.name).join(", ")}</span>
            </p>
          ))}
        </div>
        <h2 className="mt-7 border-b border-white/20 pb-1 text-[10px] font-semibold uppercase tracking-[.14em]">Education</h2>
        <div className="mt-3 space-y-3 text-xs leading-5">
          {content.education.map((item) => (
            <p key={item.educationId}>
              <span className="font-semibold">{item.degree}{item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""}</span>
              <span className="mt-0.5 block opacity-90">{item.institution}</span>
            </p>
          ))}
        </div>
        {content.credentials.length > 0 && (
          <>
            <h2 className="mt-7 border-b border-white/20 pb-1 text-[10px] font-semibold uppercase tracking-[.14em]">Credentials</h2>
            <ul className="mt-3 space-y-1.5 text-xs leading-5">{content.credentials.map((item) => <li key={item.credentialId}>{item.name}</li>)}</ul>
          </>
        )}
      </aside>
      <main className="space-y-6 px-6 py-8 sm:px-8">
        {header === "split" && <p className="resume-muted text-xs uppercase tracking-[.14em]">{content.target.jobTitle} · {content.target.employer}</p>}
        <section>
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-2 text-sm leading-6">{content.summary}</p>
        </section>
        <section>
          <SectionLabel>Experience</SectionLabel>
          <div className="mt-3"><ExperienceBlock content={content} /></div>
        </section>
        {content.projects.length > 0 && (
          <section>
            <SectionLabel>Projects</SectionLabel>
            <div className="mt-3 space-y-3">{content.projects.map((project) => <section key={project.projectId}><h3 className="text-sm font-semibold">{project.name}</h3><ul className="mt-1 list-disc pl-4 text-sm leading-6">{project.bullets.map((bullet, index) => <li key={`${project.projectId}-${index}`}>{bullet}</li>)}</ul></section>)}</div>
          </section>
        )}
      </main>
    </article>
  );
}

function ExecutiveResumeLayout({ content, header }: { content: TargetResumeContent; header: HeaderId }) {
  return (
    <>
      <PaperHeader content={content} header={header} />
      <div className="space-y-6 px-8 py-6 sm:px-12">
        <section>
          <h2 className="text-xl">Profile</h2>
          <p className="mt-2 text-sm leading-7">{content.summary}</p>
        </section>
        <section>
          <h2 className="text-xl">Experience</h2>
          <div className="mt-3"><ExperienceBlock content={content} /></div>
        </section>
        {content.projects.length > 0 && (
          <section>
            <h2 className="text-xl">Selected projects</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">{content.projects.map((project) => <section key={project.projectId}><h3 className="text-sm font-semibold">{project.name}</h3><ul className="mt-1 list-disc pl-4 text-sm leading-6">{project.bullets.map((bullet, index) => <li key={`${project.projectId}-${index}`}>{bullet}</li>)}</ul></section>)}</div>
          </section>
        )}
        <section className="resume-rule grid gap-6 border-t pt-5 sm:grid-cols-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[.16em]">Skills</h2>
            <div className="mt-2 space-y-2 text-xs leading-5">{content.skillGroups.map((group) => <p key={group.category}><span className="font-semibold">{categoryLabel(group.category)}: </span>{group.skills.map((skill) => skill.name).join(", ")}</p>)}</div>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[.16em]">Education</h2>
            <div className="mt-2 space-y-2 text-xs leading-5">{content.education.map((item) => <p key={item.educationId}><span className="font-semibold">{item.degree}</span><br />{item.institution}</p>)}</div>
          </div>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[.16em]">Credentials</h2>
            <ul className="mt-2 space-y-1 text-xs leading-5">{content.credentials.map((item) => <li key={item.credentialId}>{item.name}</li>)}</ul>
          </div>
        </section>
      </div>
    </>
  );
}

function CompactResume({ content, header }: { content: TargetResumeContent; header: HeaderId }) {
  const skills = content.skillGroups.flatMap((group) => group.skills.map((skill) => skill.name));
  return (
    <>
      <PaperHeader content={content} header={header} compact />
      <div className="space-y-4 px-7 py-4 sm:px-9">
        <p className="text-xs leading-5">{content.summary}</p>
        {skills.length > 0 && <p className="text-[11px] leading-5"><span className="font-semibold">Skills: </span>{skills.join(" · ")}</p>}
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-[.16em]">Experience</h2>
          <div className="mt-2"><ExperienceBlock content={content} compact /></div>
        </section>
        <section className="resume-rule grid gap-4 border-t pt-3 sm:grid-cols-2">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[.16em]">Education</h2>
            <div className="mt-1 space-y-1 text-xs">{content.education.map((item) => <p key={item.educationId}>{item.degree}{item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""} — {item.institution}</p>)}</div>
          </div>
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[.16em]">Credentials</h2>
            <ul className="mt-1 space-y-1 text-xs">{content.credentials.map((item) => <li key={item.credentialId}>{item.name}</li>)}</ul>
          </div>
        </section>
      </div>
    </>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[.14em] text-[#93A0B5]">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>{children}</div>
    </div>
  );
}

function Choice({ selected, name, onSelect }: { selected: boolean; name: string; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${selected ? "kym-action text-white" : "border border-[#1C283C] text-[#F4F7FB]"}`}>
      {name}
    </button>
  );
}

export function ResumeLayoutGallery({ content, targetId }: { content: TargetResumeContent; targetId: string }) {
  const [layout, setLayout] = useState<LayoutId>("classic");
  const [paletteId, setPaletteId] = useState<Palette["id"]>("ink");
  const [fontId, setFontId] = useState<FontChoice["id"]>("modern");
  const [header, setHeader] = useState<HeaderId>("rule");
  const [download, setDownload] = useState<"pdf" | "docx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const palette = palettes.find((item) => item.id === paletteId) ?? palettes[0];
  const font = fonts.find((item) => item.id === fontId) ?? fonts[0];
  const selected = layouts.find((item) => item.id === layout) ?? layouts[0];
  const shell = "resume-paper overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,.18)]";

  async function saveFile(format: "pdf" | "docx") {
    setDownload(format);
    setDownloadError(null);
    try {
      const params = new URLSearchParams({ format, layout, color: paletteId, type: fontId, header });
      const response = await fetch(`/api/resumes/targets/${targetId}/export?${params}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "The résumé could not be downloaded.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] ?? `resume.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setDownloadError(caught instanceof Error ? caught.message : "The résumé could not be downloaded.");
    } finally {
      setDownload(null);
    }
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        <OptionRow label="Layout">
          {layouts.map((item) => <Choice key={item.id} name={item.name} selected={layout === item.id} onSelect={() => setLayout(item.id)} />)}
        </OptionRow>
        <OptionRow label="Color">
          {palettes.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={paletteId === item.id} aria-label={item.name} onClick={() => setPaletteId(item.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold ${paletteId === item.id ? "kym-action text-white" : "border border-[#1C283C] text-[#F4F7FB]"}`}>
              <span className="size-3 rounded-full border border-white/40" style={{ background: item.accent }} />
              {item.name}
            </button>
          ))}
        </OptionRow>
        <OptionRow label="Type">
          {fonts.map((item) => <Choice key={item.id} name={item.name} selected={fontId === item.id} onSelect={() => setFontId(item.id)} />)}
        </OptionRow>
        <OptionRow label="Header">
          {headers.map((item) => <Choice key={item.id} name={item.name} selected={header === item.id} onSelect={() => setHeader(item.id)} />)}
        </OptionRow>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[.14em] text-[#93A0B5]">Export</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveFile("pdf")} disabled={Boolean(download)} className="inline-flex min-h-11 items-center gap-2 rounded-full kym-action px-4 text-sm font-semibold text-white disabled:opacity-60">{download === "pdf" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF</button>
            <button type="button" onClick={() => void saveFile("docx")} disabled={Boolean(download)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#1C283C] px-4 text-sm font-semibold text-[#F4F7FB] disabled:opacity-60">{download === "docx" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Download Word</button>
          </div>
        </div>
      </div>
      {downloadError && <p role="alert" className="mb-4 text-sm text-[#67E8F9]">{downloadError}</p>}
      <p className="mb-4 text-sm text-[#93A0B5]">{selected.note}</p>
      {layout === "sidebar" ? (
        <div className={shell} style={paperVars(palette, font)}><SidebarResume content={content} header={header} /></div>
      ) : (
        <article className={shell} style={paperVars(palette, font)}>
          {layout === "executive" && <ExecutiveResumeLayout content={content} header={header} />}
          {layout === "compact" && <CompactResume content={content} header={header} />}
          {layout === "classic" && <ClassicResume content={content} header={header} />}
        </article>
      )}
    </div>
  );
}
