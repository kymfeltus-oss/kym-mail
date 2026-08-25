import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import type { ResumeContent } from "@/lib/resumes/types";
import { formatResumeDate } from "@/lib/resumes/format";

const NAVY = "183A5A";
const ROSE = "D95B72";
const SLATE = "64748B";
const docText = (text: string, options: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, font: "Arial", size: options.size ?? 19, bold: options.bold, color: options.color ?? NAVY, italics: options.italics });
const sectionHeading = (text: string) => new Paragraph({ spacing: { before: 120, after: 45 }, border: { bottom: { color: ROSE, style: BorderStyle.SINGLE, size: 7, space: 2 } }, children: [docText(text.toUpperCase(), { bold: true, size: 18, color: ROSE })] });

export async function renderResumeDocx(content: ResumeContent) {
  const body: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 25 }, children: [docText(content.candidate.fullName, { bold: true, size: 31 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [docText(content.candidate.headline, { size: 18, color: SLATE })] }),
    ...(content.candidate.location ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 65 }, children: [docText(content.candidate.location, { size: 17, color: SLATE })] })] : []),
    sectionHeading("Executive Summary"),
    new Paragraph({ spacing: { after: 60, line: 225 }, children: [docText(content.summary.text)] }),
    sectionHeading("Core Skills")
  ];
  for (const group of content.skillGroups) body.push(new Paragraph({ spacing: { after: 25 }, children: [docText(`${group.category[0]}${group.category.slice(1).toLowerCase()}: `, { bold: true }), docText(group.skills.map((item) => item.name).join(" • "), { color: SLATE })] }));
  body.push(sectionHeading("Professional Experience"));
  for (const experience of content.experiences) {
    const dates = `${formatResumeDate(experience.startDate, experience.startPrecision)} – ${formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}`;
    body.push(new Paragraph({ keepNext: true, spacing: { before: 75, after: 12 }, children: [docText(experience.title ?? "Title not provided", { bold: true, size: 20 }), docText(` | ${experience.employer}`, { bold: true, size: 20, color: ROSE })] }));
    body.push(new Paragraph({ keepNext: true, spacing: { after: 30 }, children: [docText(dates, { size: 17, color: SLATE, italics: true }), ...(experience.client ? [docText(` | Client: ${experience.client}`, { size: 17, color: SLATE })] : [])] }));
    for (const bullet of experience.bullets) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 20, line: 215 }, children: [docText(bullet.text)] }));
  }
  if (content.projects.length) {
    body.push(sectionHeading("Selected Projects"));
    for (const project of content.projects) {
      body.push(new Paragraph({ keepNext: true, spacing: { before: 55, after: 20 }, children: [docText(project.name, { bold: true, size: 20 })] }));
      for (const bullet of project.bullets) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 20, line: 215 }, children: [docText(bullet.text)] }));
    }
  }
  body.push(sectionHeading("Education & Credentials"));
  for (const item of content.education) body.push(new Paragraph({ spacing: { after: 20 }, children: [docText(`${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}`, { bold: true }), docText(` — ${item.institution}`, { color: SLATE })] }));
  for (const item of content.credentials) body.push(new Paragraph({ spacing: { after: 20 }, children: [docText(item.name, { bold: true }), docText(` — ${item.status[0]}${item.status.slice(1).toLowerCase()}`, { color: SLATE })] }));
  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 19, color: NAVY }, paragraph: { spacing: { after: 20 } } } }, paragraphStyles: [{ id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 19, color: NAVY }, paragraph: { indent: { left: 270, hanging: 150 }, numbering: { reference: "resume-bullets", level: 0 } } }] },
    numbering: { config: [{ reference: "resume-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 270, hanging: 150 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 620, right: 760, bottom: 620, left: 760 } } }, children: body }]
  });
  return Buffer.from(await Packer.toBuffer(document));
}

export async function renderResumePdf(content: ResumeContent) {
  const document = new PDFDocument({ size: "LETTER", margins: { top: 32, right: 44, bottom: 32, left: 44 }, info: { Title: `${content.candidate.fullName} — Tailored Resume`, Author: content.candidate.fullName, Subject: `${content.target.jobTitle} at ${content.target.employer}` } });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => { document.on("end", () => resolve(Buffer.concat(chunks))); document.on("error", reject); });
  const ensure = (height: number) => { if (document.y + height > document.page.height - 34) document.addPage(); };
  const heading = (text: string) => { ensure(28); document.moveDown(0.35).font("Helvetica-Bold").fontSize(9).fillColor(`#${ROSE}`).text(text.toUpperCase(), { characterSpacing: 0.8 }); document.moveTo(44, document.y + 2).lineTo(document.page.width - 44, document.y + 2).lineWidth(0.7).strokeColor(`#${ROSE}`).stroke(); document.moveDown(0.35); };
  document.font("Helvetica-Bold").fontSize(17).fillColor(`#${NAVY}`).text(content.candidate.fullName, { align: "center" });
  document.moveDown(0.15).font("Helvetica").fontSize(8.5).fillColor(`#${SLATE}`).text(content.candidate.headline, { align: "center" });
  if (content.candidate.location) document.moveDown(0.1).fontSize(8).text(content.candidate.location, { align: "center" });
  heading("Executive Summary"); document.font("Helvetica").fontSize(8.5).fillColor(`#${NAVY}`).text(content.summary.text, { lineGap: 1.3 });
  heading("Core Skills");
  for (const group of content.skillGroups) document.font("Helvetica-Bold").fontSize(8).fillColor(`#${NAVY}`).text(`${group.category[0]}${group.category.slice(1).toLowerCase()}: `, { continued: true }).font("Helvetica").fillColor(`#${SLATE}`).text(group.skills.map((item) => item.name).join(" • "), { lineGap: 0.7 });
  heading("Professional Experience");
  for (const experience of content.experiences) {
    ensure(52); document.moveDown(0.2).font("Helvetica-Bold").fontSize(9).fillColor(`#${NAVY}`).text(experience.title ?? "Title not provided", { continued: true }).fillColor(`#${ROSE}`).text(` | ${experience.employer}`);
    const dates = `${formatResumeDate(experience.startDate, experience.startPrecision)} – ${formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}`;
    document.font("Helvetica-Oblique").fontSize(7.5).fillColor(`#${SLATE}`).text(`${dates}${experience.client ? ` | Client: ${experience.client}` : ""}`);
    for (const bullet of experience.bullets) { ensure(24); document.font("Helvetica").fontSize(8.1).fillColor(`#${NAVY}`).text(`•  ${bullet.text}`, { indent: 8, lineGap: 0.7 }); }
  }
  if (content.projects.length) {
    heading("Selected Projects");
    for (const project of content.projects) { ensure(40); document.font("Helvetica-Bold").fontSize(9).fillColor(`#${NAVY}`).text(project.name); for (const bullet of project.bullets) document.font("Helvetica").fontSize(8.1).text(`•  ${bullet.text}`, { indent: 8, lineGap: 0.7 }); }
  }
  heading("Education & Credentials");
  for (const item of content.education) document.font("Helvetica-Bold").fontSize(8.2).fillColor(`#${NAVY}`).text(`${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}`, { continued: true }).font("Helvetica").fillColor(`#${SLATE}`).text(` — ${item.institution}`);
  for (const item of content.credentials) document.font("Helvetica-Bold").fontSize(8.2).fillColor(`#${NAVY}`).text(item.name, { continued: true }).font("Helvetica").fillColor(`#${SLATE}`).text(` — ${item.status[0]}${item.status.slice(1).toLowerCase()}`);
  document.end();
  return complete;
}

