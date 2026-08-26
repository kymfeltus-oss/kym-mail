import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { fingerprint } from "../src/lib/jobs/analysis";
import { loadCareerFacts } from "../src/lib/resumes/career";
import { renderResumePdf } from "../src/lib/resumes/exports";
import { buildResumePlan } from "../src/lib/resumes/plan";
import { getResumeGenerationProvider } from "../src/lib/resumes/provider";
import { validateResumeContent } from "../src/lib/resumes/validation";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerEmail = process.env.KYM_DEV_OWNER_EMAIL;
  if (!url || !key || !ownerEmail) throw new Error("Gate 7 PDF QA environment is incomplete.");
  const database = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const users = await database.auth.admin.listUsers({ page: 1, perPage: 100 });
  const owner = users.data.users.find((user) => user.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (!owner) throw new Error("Gate 7 PDF QA owner was not found.");
  const { data: analysis, error: analysisError } = await database.from("job_analyses").select("id, job_opportunity_id, analysis_version, status, description_fingerprint").eq("owner_id", owner.id).eq("status", "COMPLETE").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (analysisError || !analysis) throw new Error("Gate 7 PDF QA requires a real completed Career Match.");
  const { data: job, error: jobError } = await database.from("job_opportunities").select("id, title, company_name, description_text").eq("id", analysis.job_opportunity_id).eq("owner_id", owner.id).maybeSingle();
  if (jobError || !job || analysis.description_fingerprint !== fingerprint(job.description_text ?? "")) throw new Error("Gate 7 PDF QA Career Match is stale.");
  const career = await loadCareerFacts(database, owner.id);
  const plan = await buildResumePlan(database, owner.id, job.id, { id: analysis.id, version: analysis.analysis_version }, career);
  const provider = getResumeGenerationProvider();
  const proposed = await provider.generate({ plan, career, job: { id: job.id, title: job.title, employer: job.company_name, description: job.description_text ?? "" } });
  const { data: unsupported } = await database.from("job_analysis_requirements").select("normalized_concept").eq("owner_id", owner.id).eq("analysis_id", analysis.id).eq("match_state", "NO_MATCH");
  const unsupportedTerms = (unsupported ?? []).map((item) => item.normalized_concept).filter((item): item is string => Boolean(item));
  const content = validateResumeContent(proposed, career, { title: job.title, employer: job.company_name }, unsupportedTerms).content;
  const executive = await renderResumePdf(content, { presentation: "EXECUTIVE" });
  const ats = await renderResumePdf(content, { presentation: "ATS" });
  const stress = structuredClone(content);
  const firstBullet = stress.experiences[0]?.bullets[0];
  if (firstBullet) firstBullet.text = Array.from({ length: 12 }, () => firstBullet.text).join(" ").slice(0, 2990);
  const stressPdf = await renderResumePdf(stress, { presentation: "EXECUTIVE" });
  const [executiveDocument, atsDocument, stressDocument] = await Promise.all([PDFDocument.load(executive), PDFDocument.load(ats), PDFDocument.load(stressPdf)]);
  if (!executiveDocument.getPageCount() || !atsDocument.getPageCount() || stressDocument.getPageCount() < executiveDocument.getPageCount()) throw new Error("Gate 7 PDF pagination verification failed.");
  const outputDirectory = resolve("output", "pdf");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = resolve(outputDirectory, "gate7-real-approved-content-qa.pdf");
  await writeFile(outputPath, executive);
  process.stdout.write(JSON.stringify({ outputPath, jobTitle: job.title, employer: job.company_name, executivePages: executiveDocument.getPageCount(), atsPages: atsDocument.getPageCount(), stressPages: stressDocument.getPageCount(), provider: provider.key }));
}

void main().catch((error) => { process.stderr.write(error instanceof Error ? error.message : "Gate 7 PDF QA failed."); process.exitCode = 1; });
