import { formatResumeDate } from "@/lib/resumes/format";
import type { TargetResumeContent } from "@/lib/resumes/target/types";

export function ExpressiveResume({ content }: { content: TargetResumeContent }) {
  return (
    <article className="overflow-hidden bg-[#F7F1E6] text-[#1A1410] shadow-[0_30px_90px_rgba(26,20,16,.16)]">
      <header className="relative border-b border-[#C4A574] bg-[#111111] px-6 py-10 text-[#F7F1E6] sm:px-10 sm:py-14">
        <p className="text-[10px] font-semibold uppercase tracking-[.34em] text-[#C4A574]">Private correspondence · Targeted resume</p>
        <h1 className="mt-5 break-words font-serif text-5xl tracking-[-.05em] sm:text-7xl">{content.candidate.fullName}</h1>
        <p className="mt-4 max-w-3xl font-serif text-xl leading-8 text-[#E8D9B8]">{content.thesis}</p>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[#C4A574]">
          <span>{content.target.jobTitle}</span>
          <span>{content.target.employer}</span>
          {content.candidate.location && <span>{content.candidate.location}</span>}
        </div>
      </header>
      <div className="grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1.65fr)_minmax(240px,.75fr)]">
        <main className="min-w-0 space-y-10">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Positioning</p>
            <h2 className="mt-1 font-serif text-3xl tracking-[-.03em]">The brief, answered</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-8 text-[#3D3228]">{content.summary}</p>
          </section>
          {Boolean(content.highlights.length) && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Selected for this role</p>
              <h2 className="mt-1 font-serif text-3xl tracking-[-.03em]">What this version elevates</h2>
              <ol className="mt-5 grid gap-4 sm:grid-cols-2">
                {content.highlights.map((item) => (
                  <li key={`${item.source}:${item.text.slice(0, 24)}`} className="border-l-2 border-[#C4A574] bg-white/55 py-3 pl-4 pr-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#8A6A32]">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 text-[#3D3228]">{item.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {Boolean(content.confirmedCapabilities.length) && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Owner-confirmed</p>
              <h2 className="mt-1 font-serif text-3xl tracking-[-.03em]">Added from your prompt</h2>
              <div className="mt-5 space-y-4">
                {content.confirmedCapabilities.map((item) => (
                  <article key={item.requirementId} className="border border-[#C4A574] bg-[#FFFBF3] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8A6A32]">{item.requirement}</p>
                    <p className="mt-3 text-sm leading-7 text-[#3D3228]">{item.statement}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Selected impact</p>
            <h2 className="mt-1 font-serif text-3xl tracking-[-.03em]">Experience</h2>
            <div className="mt-6 space-y-8">
              {content.experiences.map((experience) => (
                <section key={experience.experienceId}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-serif text-2xl text-[#111111]">{experience.title ?? "Leadership role"}</h3>
                      <p className="mt-1 text-sm font-semibold text-[#8A6A32]">{experience.employer}{experience.client ? ` · Client: ${experience.client}` : ""}</p>
                    </div>
                    <p className="shrink-0 text-xs uppercase tracking-[.1em] text-[#6B5A48]">{formatResumeDate(experience.startDate, experience.startPrecision)} – {formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}</p>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {experience.bullets.map((bullet) => (
                      <li key={bullet} className="grid grid-cols-[12px_1fr] gap-3 text-sm leading-7 text-[#3D3228]">
                        <span className="mt-3 h-px bg-[#C4A574]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
          {content.projects.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Applications</p>
              <h2 className="mt-1 font-serif text-3xl tracking-[-.03em]">Projects</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {content.projects.map((project) => (
                  <article key={project.projectId} className="border-t-2 border-[#111111] bg-white/70 p-5">
                    <h3 className="font-serif text-xl">{project.name}</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[#3D3228]">{project.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
        <aside className="min-w-0 space-y-8 lg:border-l lg:border-[#C4A574] lg:pl-8">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Craft</p>
            <div className="mt-4 space-y-4">
              {content.skillGroups.map((group) => (
                <div key={group.category}>
                  <h2 className="text-xs font-semibold uppercase tracking-[.12em] text-[#111111]">{group.category.toLowerCase()}</h2>
                  <p className="mt-1 break-words text-sm leading-6 text-[#6B5A48]">{group.skills.map((skill) => skill.name).join(" · ")}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-[#C4A574] pt-7">
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Education</p>
            <div className="mt-4 space-y-4">
              {content.education.map((item) => (
                <div key={item.educationId}>
                  <h2 className="text-sm font-semibold">{item.degree}{item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#6B5A48]">{item.institution}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-[#C4A574] pt-7">
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#8A6A32]">Credentials</p>
            <div className="mt-4 space-y-3">
              {content.credentials.map((item) => (
                <p key={item.credentialId} className="text-sm leading-6"><strong>{item.name}</strong><br /><span className="text-xs uppercase tracking-[.08em] text-[#6B5A48]">{item.status.toLowerCase()}</span></p>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
