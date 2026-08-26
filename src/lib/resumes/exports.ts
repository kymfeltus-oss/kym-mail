import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ResumeContent } from "@/lib/resumes/types";
import { formatResumeDate } from "@/lib/resumes/format";

const BURGUNDY = "8D2948";
const PLUM = "3E1D2C";
const TAUPE = "70626A";
const docText = (text: string, options: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, font: "Arial", size: options.size ?? 19, bold: options.bold, color: options.color ?? PLUM, italics: options.italics });
const sectionHeading = (text: string) => new Paragraph({ spacing: { before: 120, after: 45 }, border: { bottom: { color: BURGUNDY, style: BorderStyle.SINGLE, size: 7, space: 2 } }, children: [docText(text.toUpperCase(), { bold: true, size: 18, color: BURGUNDY })] });

export async function renderResumeDocx(content: ResumeContent) {
  const body: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 25 }, children: [docText(content.candidate.fullName, { bold: true, size: 31 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [docText(content.positioning?.text ?? content.candidate.headline, { size: 18, color: TAUPE })] }),
    ...(content.candidate.location ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [docText(content.candidate.location, { size: 17, color: TAUPE })] })] : []),
    sectionHeading("Executive Summary"),
    new Paragraph({ spacing: { after: 45, line: 220 }, children: [docText(content.summary.text)] })
  ];
  if (content.whyFit?.length) {
    body.push(sectionHeading("Why I Fit This Role"));
    for (const item of content.whyFit) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 14, line: 210 }, children: [docText(item.text)] }));
  }
  body.push(sectionHeading("Core Skills"));
  for (const group of content.skillGroups) body.push(new Paragraph({ spacing: { after: 20 }, children: [docText(`${group.category[0]}${group.category.slice(1).toLowerCase()}: `, { bold: true }), docText(group.skills.map((item) => item.name).join(" • "), { color: TAUPE })] }));
  body.push(sectionHeading("Professional Experience"));
  for (const experience of content.experiences) {
    const dates = `${formatResumeDate(experience.startDate, experience.startPrecision)} – ${formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}`;
    body.push(new Paragraph({ keepNext: true, spacing: { before: 60, after: 12 }, children: [docText(experience.title ?? "Title not provided", { bold: true, size: 20 }), docText(` | ${experience.employer}`, { bold: true, size: 20, color: BURGUNDY })] }));
    body.push(new Paragraph({ keepNext: true, spacing: { after: 24 }, children: [docText(dates, { size: 17, color: TAUPE, italics: true }), ...(experience.client ? [docText(` | Client: ${experience.client}`, { size: 17, color: TAUPE })] : [])] }));
    for (const bullet of experience.bullets) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 14, line: 210 }, children: [docText(bullet.text)] }));
  }
  if (content.projects.length) {
    body.push(sectionHeading("Selected Applications & Projects"));
    for (const project of content.projects) {
      body.push(new Paragraph({ keepNext: true, spacing: { before: 45, after: 15 }, children: [docText(project.name, { bold: true, size: 20 })] }));
      for (const bullet of project.bullets) body.push(new Paragraph({ style: "ResumeBullet", spacing: { after: 14, line: 210 }, children: [docText(bullet.text)] }));
    }
  }
  body.push(sectionHeading("Education & Credentials"));
  for (const item of content.education) body.push(new Paragraph({ spacing: { after: 12 }, children: [docText(`${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}`, { bold: true }), docText(` — ${item.institution}`, { color: TAUPE })] }));
  for (const item of content.credentials) {
    const status = `${item.status[0]}${item.status.slice(1).toLowerCase()}`;
    body.push(new Paragraph({ spacing: { after: 12 }, children: [docText(item.name, { bold: true }), ...(!item.name.toLowerCase().includes(status.toLowerCase()) ? [docText(` — ${status}`, { color: TAUPE })] : [])] }));
  }
  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 19, color: PLUM }, paragraph: { spacing: { after: 20 } } } }, paragraphStyles: [{ id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 19, color: PLUM }, paragraph: { indent: { left: 270, hanging: 150 }, numbering: { reference: "resume-bullets", level: 0 } } }] },
    numbering: { config: [{ reference: "resume-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 270, hanging: 150 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 500, right: 760, bottom: 420, left: 760 } } }, children: body }]
  });
  return Buffer.from(await Packer.toBuffer(document));
}

export async function renderResumePdf(content: ResumeContent, options: { presentation?: "EXECUTIVE" | "ATS" } = {}) {
  const ats = options.presentation === "ATS";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${content.candidate.fullName} - ${ats ? "ATS " : ""}Resume`);
  pdf.setAuthor(content.candidate.fullName);
  pdf.setSubject(`${content.target.jobTitle} at ${content.target.employer}`);
  pdf.setCreator("KYM Mail Gate 7");
  pdf.setProducer("KYM Mail Gate 7");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const plum = ats ? rgb(0.1, 0.1, 0.1) : rgb(62 / 255, 29 / 255, 44 / 255);
  const burgundy = ats ? rgb(0.1, 0.1, 0.1) : rgb(141 / 255, 41 / 255, 72 / 255);
  const taupe = ats ? rgb(0.25, 0.25, 0.25) : rgb(112 / 255, 98 / 255, 106 / 255);
  const width = 612;
  const height = 792;
  const margin = ats ? 48 : 46;
  const maxWidth = width - margin * 2;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - 40;
  const safeText = (value: string) => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "-");
  const wrap = (value: string, font: PDFFont, size: number, available = maxWidth) => {
    const output: string[] = [];
    for (const paragraph of safeText(value).split(/\n+/)) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= available || !line) line = candidate;
        else { output.push(line); line = word; }
      }
      if (line) output.push(line);
    }
    return output;
  };
  const newPage = () => { page = pdf.addPage([width, height]); y = height - 40; };
  const ensure = (needed: number) => { if (y - needed < 38) newPage(); };
  const paragraph = (value: string, paragraphOptions: { font?: PDFFont; size?: number; color?: typeof plum; indent?: number; gap?: number; center?: boolean } = {}) => {
    const font = paragraphOptions.font ?? regular;
    const size = paragraphOptions.size ?? (ats ? 9.2 : 8.7);
    const indent = paragraphOptions.indent ?? 0;
    const lineHeight = size + (ats ? 3 : 2.8);
    for (const line of wrap(value, font, size, maxWidth - indent)) {
      ensure(lineHeight);
      const lineWidth = font.widthOfTextAtSize(line, size);
      page.drawText(line, { x: paragraphOptions.center ? (width - lineWidth) / 2 : margin + indent, y, size, font, color: paragraphOptions.color ?? plum });
      y -= lineHeight;
    }
    y -= paragraphOptions.gap ?? 3;
  };
  const heading = (value: string) => {
    ensure(34); y -= 8;
    page.drawText(value.toUpperCase(), { x: margin, y, size: ats ? 9 : 8.5, font: bold, color: burgundy });
    y -= 5;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: ats ? 0.5 : 0.8, color: burgundy });
    y -= 13;
  };
  paragraph(content.candidate.fullName, { font: ats ? bold : serif, size: ats ? 18 : 22, center: true, gap: 2 });
  paragraph(content.positioning?.text ?? content.candidate.headline, { size: 9, color: taupe, center: true, gap: 0 });
  paragraph(`${content.target.jobTitle} | ${content.target.employer}`, { font: bold, size: 7.8, color: burgundy, center: true, gap: 0 });
  if (content.candidate.location) paragraph(content.candidate.location, { size: 7.8, color: taupe, center: true, gap: 2 });
  heading("Executive Summary"); paragraph(content.summary.text, { size: ats ? 9.3 : 8.8, gap: 2 });
  if (content.whyFit?.length) { heading("Why I Fit This Role"); for (const item of content.whyFit) paragraph(`- ${item.text}`, { size: ats ? 9 : 8.5, indent: 8, gap: 1 }); }
  heading("Core Skills");
  for (const group of content.skillGroups) paragraph(`${group.category[0]}${group.category.slice(1).toLowerCase()}: ${group.skills.map((item) => item.name).join(" | ")}`, { size: ats ? 8.7 : 8, color: taupe, gap: 0 });
  heading("Professional Experience");
  const plannedBreakIndex = content.experiences.length >= 6 ? Math.ceil(content.experiences.length / 2) : -1;
  for (const [experienceIndex, experience] of content.experiences.entries()) {
    if (experienceIndex === plannedBreakIndex) { newPage(); heading("Professional Experience continued"); }
    ensure(58); y -= 2;
    paragraph(`${experience.title ?? "Title not provided"} | ${experience.employer}`, { font: bold, size: ats ? 10 : 9.4, gap: 0 });
    const dates = `${formatResumeDate(experience.startDate, experience.startPrecision)} - ${formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}`;
    paragraph(`${dates}${experience.client ? ` | Client: ${experience.client}` : ""}`, { font: italic, size: 7.7, color: taupe, gap: 2 });
    for (const bullet of experience.bullets) paragraph(`- ${bullet.text}`, { size: ats ? 9 : 8.4, indent: 8, gap: 1 });
  }
  if (content.projects.length) {
    heading("Selected Applications & Projects");
    for (const project of content.projects) { ensure(48); paragraph(project.name, { font: bold, size: ats ? 9.5 : 9, gap: 1 }); for (const bullet of project.bullets) paragraph(`- ${bullet.text}`, { size: ats ? 9 : 8.4, indent: 8, gap: 1 }); }
  }
  heading("Education & Credentials");
  for (const item of content.education) paragraph(`${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""} - ${item.institution}`, { size: ats ? 9 : 8.5, gap: 1 });
  for (const item of content.credentials) {
    const status = `${item.status[0]}${item.status.slice(1).toLowerCase()}`;
    paragraph(item.name.toLowerCase().includes(status.toLowerCase()) ? item.name : `${item.name} - ${status}`, { size: ats ? 9 : 8.5, gap: 1 });
  }
  return Buffer.from(await pdf.save());
}
