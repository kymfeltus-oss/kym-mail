import { formatResumeDate } from "@/lib/resumes/format";

export type PublicResumeContent = {
  candidate: { fullName: string; headline: string; location: string | null };
  target: { jobTitle: string; employer: string };
  positioning?: string | null;
  whyFit?: string[];
  summary: string;
  experiences: Array<{ employer: string; client: string | null; title: string | null; startDate: string | null; startPrecision: "MONTH" | "YEAR" | "UNKNOWN"; endDate: string | null; endPrecision: "MONTH" | "YEAR" | "UNKNOWN"; isCurrent: boolean; location: string | null; bullets: string[] }>;
  projects: Array<{ name: string; bullets: string[] }>;
  skillGroups: Array<{ category: string; skills: string[] }>;
  education: Array<{ degree: string; fieldOfStudy: string | null; institution: string; completedOn: string | null }>;
  credentials: Array<{ name: string; status: string }>;
};

export function toPublicResume(content: { candidate: PublicResumeContent["candidate"]; target: PublicResumeContent["target"]; positioning?: { text: string }; whyFit?: Array<{ text: string }>; summary: { text: string }; experiences: Array<{ employer: string; client: string | null; title: string | null; startDate: string | null; startPrecision: "MONTH" | "YEAR" | "UNKNOWN"; endDate: string | null; endPrecision: "MONTH" | "YEAR" | "UNKNOWN"; isCurrent: boolean; location: string | null; bullets: Array<{ text: string }> }>; projects: Array<{ name: string; bullets: Array<{ text: string }> }>; skillGroups: Array<{ category: string; skills: Array<{ name: string }> }>; education: PublicResumeContent["education"]; credentials: PublicResumeContent["credentials"] }): PublicResumeContent {
  return {
    candidate: content.candidate,
    target: content.target,
    positioning: content.positioning?.text ?? null,
    whyFit: content.whyFit?.map((item) => item.text) ?? [],
    summary: content.summary.text,
    experiences: content.experiences.map((item) => ({ ...item, bullets: item.bullets.map((bullet) => bullet.text) })),
    projects: content.projects.map((item) => ({ name: item.name, bullets: item.bullets.map((bullet) => bullet.text) })),
    skillGroups: content.skillGroups.map((group) => ({ category: group.category, skills: group.skills.map((skill) => skill.name) })),
    education: content.education,
    credentials: content.credentials.map((item) => ({ ...item, status: item.name.toLowerCase().includes(item.status.toLowerCase()) ? "" : item.status }))
  };
}

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return <section className="border-t border-[#D8CAC8] pt-7 sm:pt-9">{eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#9A3857]">{eyebrow}</p>}<h2 className="mt-1 font-serif text-2xl tracking-[-.03em] text-[#351E2A] sm:text-3xl">{title}</h2><div className="mt-5">{children}</div></section>;
}

export function ExecutiveResume({ content }: { content: PublicResumeContent }) {
  return <article className="overflow-hidden bg-[#FDFBF9] text-[#3C3036] shadow-[0_28px_90px_rgba(61,29,43,.12)]">
    <header className="relative overflow-hidden border-b border-[#D8CAC8] px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16"><div aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(154,56,87,.16),transparent_68%)]" /><div className="relative max-w-4xl"><p className="text-[10px] font-semibold uppercase tracking-[.28em] text-[#9A3857]">Executive resume · {content.target.employer}</p><h1 className="mt-5 break-words font-serif text-5xl tracking-[-.055em] text-[#351E2A] sm:text-7xl">{content.candidate.fullName}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-[#685A61] sm:text-xl">{content.positioning ?? content.candidate.headline}</p><div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-[.12em] text-[#806F77]"><span>{content.target.jobTitle}</span>{content.candidate.location && <span>{content.candidate.location}</span>}</div></div></header>
    <div className="grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1.7fr)_minmax(250px,.75fr)] lg:px-16">
      <main className="min-w-0 space-y-10 sm:space-y-12"><Section eyebrow="Executive positioning" title="Profile"><p className="max-w-3xl text-[15px] leading-8 text-[#574B51]">{content.summary}</p></Section>{Boolean(content.whyFit?.length) && <Section eyebrow="Role-specific" title="Why I fit this role"><ol className="grid gap-4 sm:grid-cols-2">{content.whyFit?.map((item, index) => <li key={`${index}:${item.slice(0, 20)}`} className="border-l-2 border-[#9A3857] pl-4 text-sm leading-7 text-[#574B51]">{item}</li>)}</ol></Section>}<Section eyebrow="Selected impact" title="Executive experience"><div className="space-y-9">{content.experiences.map((experience, index) => <section key={`${index}:${experience.employer}`} className="break-inside-avoid"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-serif text-xl text-[#351E2A]">{experience.title ?? "Leadership role"}</h3><p className="mt-1 text-sm font-semibold text-[#9A3857]">{experience.employer}{experience.client ? ` · Client: ${experience.client}` : ""}</p></div><p className="shrink-0 text-xs uppercase tracking-[.08em] text-[#806F77]">{formatResumeDate(experience.startDate, experience.startPrecision)} – {formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}</p></div><ul className="mt-4 space-y-3">{experience.bullets.map((bullet, bulletIndex) => <li key={`${bulletIndex}:${bullet.slice(0, 20)}`} className="grid grid-cols-[14px_1fr] gap-2 text-sm leading-7 text-[#574B51]"><span className="mt-3 h-px bg-[#9A3857]" />{bullet}</li>)}</ul></section>)}</div></Section>{content.projects.length > 0 && <Section eyebrow="Finance + systems edge" title="Selected applications & projects"><div className="grid gap-5 sm:grid-cols-2">{content.projects.map((project, index) => <section key={`${index}:${project.name}`} className="border-t-2 border-[#9A3857] bg-white/60 p-5"><h3 className="font-serif text-lg text-[#351E2A]">{project.name}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-[#574B51]">{project.bullets.map((bullet, bulletIndex) => <li key={`${bulletIndex}:${bullet.slice(0, 20)}`}>{bullet}</li>)}</ul></section>)}</div></Section>}</main>
      <aside className="min-w-0 space-y-9 lg:border-l lg:border-[#D8CAC8] lg:pl-8"><section><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#9A3857]">Systems & technology</p><div className="mt-4 space-y-4">{content.skillGroups.map((group) => <div key={group.category}><h2 className="text-xs font-semibold uppercase tracking-[.12em] text-[#351E2A]">{group.category.toLowerCase()}</h2><p className="mt-1 break-words text-sm leading-6 text-[#685A61]">{group.skills.join(" · ")}</p></div>)}</div></section><section className="border-t border-[#D8CAC8] pt-7"><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#9A3857]">Education</p><div className="mt-4 space-y-4">{content.education.map((item, index) => <div key={`${index}:${item.institution}`}><h2 className="text-sm font-semibold text-[#351E2A]">{item.degree}{item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}</h2><p className="mt-1 text-xs leading-5 text-[#806F77]">{item.institution}</p></div>)}</div></section><section className="border-t border-[#D8CAC8] pt-7"><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#9A3857]">Credentials</p><div className="mt-4 space-y-3">{content.credentials.map((item, index) => <p key={`${index}:${item.name}`} className="text-sm leading-6 text-[#574B51]"><strong className="text-[#351E2A]">{item.name}</strong><br /><span className="text-xs uppercase tracking-[.08em] text-[#806F77]">{item.status.toLowerCase()}</span></p>)}</div></section></aside>
    </div>
  </article>;
}
