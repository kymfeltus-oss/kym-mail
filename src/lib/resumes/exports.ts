import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ResumeContent } from "@/lib/resumes/types";
import { formatResumeDate } from "@/lib/resumes/format";

const NAVY = "183A5A";
const ROSE = "D95B72";
const SLATE = "64748B";
const docText = (text: string, options: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, font: "Arial", size: options.size ?? 19, bold: options.bold, color: options.color ?? NAVY, italics: options.italics });
const sectionHeading = (text: string) => new Paragraph({ spacing: { before: 90, after: 40 }, border: { bottom: { color: ROSE, style: BorderStyle.SINGLE, size: 7, space: 2 } }, children: [docText(text.toUpperCase(), { bold: true, size: 18, color: ROSE })] });

export async function renderResumeDocx(content: ResumeContent) {
  const body: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 25 }, children: [docText(content.candidate.fullName, { bold: true, size: 31 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [docText(content.candidate.headline, { size: 18, color: SLATE })] }),
    ...(content.candidate.location ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [docText(content.candidate.location, { size: 17, color: SLATE })] })] : []),
    sectionHeading("Executive Summary"),
    new Paragraph({ spacing: { after: 45, line: 220 }, children: [docText(content.summary.text)] }),
    sectionHeading("Core Skills")
  ];
  for (const group of content.skillGroups) body.push(new Paragraph({ spacing: { after: 20 }, children: [docText(`${group.category[0]}${group.category.slice(1).toLowerCase()}: `, { bold: true }), docText(group.skills.map((item) => item.name).join(" • "), { color: SLATE })] }));
  body.push(sectionHeading("Professional Experience"));
  for (const experience of content.experiences) {
    const dates = `${formatResumeDate(experience.startDate, experience.startPrecision)} – ${formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}`;
    body.push(new Paragraph({ keepNext: true, spacing: { before: 60, after: 12 }, children: [docText(experience.title ?? "Title not provided", { bold: true, size: 20 }), docText(` | ${experience.employer}`, { bold: true, size: 20, color: ROSE })] }));
    body.push(new Paragraph({ keepNext: true, spacing: { after: 24 }, children: [docText(dates, { size: 17, color: SLATE, italics: true }), ...(experience.client ? [docText(` | Client: ${experience.client}`, { size: 17, color: SLATE })] : [])] }));
    for (const bullet of experience.bullets) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 14, line: 210 }, children: [docText(bullet.text)] }));
  }
  if (content.projects.length) {
    body.push(sectionHeading("Selected Projects"));
    for (const project of content.projects) {
      body.push(new Paragraph({ keepNext: true, spacing: { before: 45, after: 15 }, children: [docText(project.name, { bold: true, size: 20 })] }));
      for (const bullet of project.bullets) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 14, line: 210 }, children: [docText(bullet.text)] }));
    }
  }
  body.push(sectionHeading("Education & Credentials"));
  for (const item of content.education) body.push(new Paragraph({ spacing: { after: 12 }, children: [docText(`${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}`, { bold: true }), docText(` — ${item.institution}`, { color: SLATE })] }));
  for (const item of content.credentials) body.push(new Paragraph({ spacing: { after: 12 }, children: [docText(item.name, { bold: true }), docText(` — ${item.status[0]}${item.status.slice(1).toLowerCase()}`, { color: SLATE })] }));
  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 19, color: NAVY }, paragraph: { spacing: { after: 20 } } } }, paragraphStyles: [{ id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 19, color: NAVY }, paragraph: { indent: { left: 270, hanging: 150 }, numbering: { reference: "resume-bullets", level: 0 } } }] },
    numbering: { config: [{ reference: "resume-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 270, hanging: 150 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 500, right: 760, bottom: 420, left: 760 } } }, children: body }]
  });
  return Buffer.from(await Packer.toBuffer(document));
}

export async function renderResumePdf(content: ResumeContent) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${content.candidate.fullName} - Tailored Resume`);
  pdf.setAuthor(content.candidate.fullName);
  pdf.setSubject(`${content.target.jobTitle} at ${content.target.employer}`);
  pdf.setCreator("KYM Mail");
  pdf.setProducer("KYM Mail");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const navy = rgb(24 / 255, 58 / 255, 90 / 255);
  const rose = rgb(217 / 255, 91 / 255, 114 / 255);
  const slate = rgb(100 / 255, 116 / 255, 139 / 255);
  const width = 612;
  const height = 792;
  const margin = 44;
  const maxWidth = width - margin * 2;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - 34;
  const safeText = (value: string) => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "-");
  const wrap = (value: string, font: PDFFont, size: number, available = maxWidth) => {
    const words = safeText(value).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= available || !line) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  };
  const newPage = () => { page = pdf.addPage([width, height]); y = height - 34; };
  const ensure = (needed: number) => { if (y - needed < 32) newPage(); };
  const paragraph = (value: string, options: { font?: PDFFont; size?: number; color?: typeof navy; indent?: number; gap?: number; center?: boolean } = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 8.1;
    const indent = options.indent ?? 0;
    const lines = wrap(value, font, size, maxWidth - indent);
    const lineHeight = size + 2;
    ensure(lines.length * lineHeight + (options.gap ?? 2));
    for (const line of lines) {
      const lineWidth = font.widthOfTextAtSize(line, size);
      page.drawText(line, { x: options.center ? (width - lineWidth) / 2 : margin + indent, y, size, font, color: options.color ?? navy });
      y -= lineHeight;
    }
    y -= options.gap ?? 2;
  };
  const heading = (value: string) => {
    ensure(25); y -= 7;
    page.drawText(value.toUpperCase(), { x: margin, y, size: 8.5, font: bold, color: rose });
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: rose });
    y -= 11;
  };
  paragraph(content.candidate.fullName, { font: bold, size: 17, center: true, gap: 1 });
  paragraph(content.candidate.headline, { size: 8.5, color: slate, center: true, gap: 0 });
  if (content.candidate.location) paragraph(content.candidate.location, { size: 8, color: slate, center: true, gap: 1 });
  heading("Executive Summary"); paragraph(content.summary.text, { size: 8.5, gap: 1 });
  heading("Core Skills");
  for (const group of content.skillGroups) paragraph(`${group.category[0]}${group.category.slice(1).toLowerCase()}: ${group.skills.map((item) => item.name).join(" | ")}`, { size: 8, color: slate, gap: 0 });
  heading("Professional Experience");
  for (const experience of content.experiences) {
    ensure(48); y -= 2;
    paragraph(`${experience.title ?? "Title not provided"} | ${experience.employer}`, { font: bold, size: 9, gap: 0 });
    const dates = `${formatResumeDate(experience.startDate, experience.startPrecision)} - ${formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}`;
    paragraph(`${dates}${experience.client ? ` | Client: ${experience.client}` : ""}`, { font: italic, size: 7.5, color: slate, gap: 1 });
    for (const bullet of experience.bullets) paragraph(`- ${bullet.text}`, { size: 8, indent: 8, gap: 0 });
  }
  if (content.projects.length) {
    heading("Selected Projects");
    for (const project of content.projects) { ensure(40); paragraph(project.name, { font: bold, size: 9, gap: 0 }); for (const bullet of project.bullets) paragraph(`- ${bullet.text}`, { size: 8, indent: 8, gap: 0 }); }
  }
  heading("Education & Credentials");
  for (const item of content.education) paragraph(`${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""} - ${item.institution}`, { size: 8.2, gap: 0 });
  for (const item of content.credentials) paragraph(`${item.name} - ${item.status[0]}${item.status.slice(1).toLowerCase()}`, { size: 8.2, gap: 0 });
  return Buffer.from(await pdf.save());
}
