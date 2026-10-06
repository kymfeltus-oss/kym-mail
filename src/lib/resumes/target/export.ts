import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatResumeDate } from "@/lib/resumes/format";
import type { TargetResumeContent } from "@/lib/resumes/target/types";

export const targetExportStyleSchema = {
  layouts: ["classic", "sidebar", "executive", "compact"] as const,
  colors: ["ink", "navy", "forest", "wine"] as const,
  types: ["modern", "traditional", "editorial"] as const,
  headers: ["rule", "center", "band", "split"] as const
};

export type TargetExportStyle = {
  layout: (typeof targetExportStyleSchema.layouts)[number];
  color: (typeof targetExportStyleSchema.colors)[number];
  type: (typeof targetExportStyleSchema.types)[number];
  header: (typeof targetExportStyleSchema.headers)[number];
};

const palettes = {
  ink: { paper: "#FFFFFF", ink: "#111827", muted: "#4B5563", accent: "#111827", bandText: "#FFFFFF" },
  navy: { paper: "#FFFFFF", ink: "#1E293B", muted: "#475569", accent: "#1E3A5F", bandText: "#F8FAFC" },
  forest: { paper: "#FFFFFF", ink: "#14261C", muted: "#3D5348", accent: "#1B4332", bandText: "#F4FBF7" },
  wine: { paper: "#FFFCF8", ink: "#2C1810", muted: "#6B5344", accent: "#7A3048", bandText: "#FFF8F4" }
} as const;

function hex(value: string) {
  return value.replace("#", "");
}

function pdfColor(value: string) {
  const raw = hex(value);
  return rgb(Number.parseInt(raw.slice(0, 2), 16) / 255, Number.parseInt(raw.slice(2, 4), 16) / 255, Number.parseInt(raw.slice(4, 6), 16) / 255);
}

function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function contactText(content: TargetResumeContent) {
  const linkedin = content.candidate.linkedin?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return [content.candidate.email, content.candidate.phone, linkedin].filter((item): item is string => Boolean(item)).join(" · ");
}

function dates(item: TargetResumeContent["experiences"][number]) {
  return `${formatResumeDate(item.startDate, item.startPrecision)} – ${formatResumeDate(item.endDate, item.endPrecision, item.isCurrent)}`;
}

function safeText(value: string) {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "-");
}

export async function renderTargetResumePdf(content: TargetResumeContent, style: TargetExportStyle) {
  const palette = palettes[style.color];
  const ink = pdfColor(palette.ink);
  const muted = pdfColor(palette.muted);
  const accent = pdfColor(palette.accent);
  const paper = pdfColor(palette.paper);
  const bandText = pdfColor(palette.bandText);
  const compact = style.layout === "compact";
  const sidebar = style.layout === "sidebar";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${content.candidate.fullName} resume`);
  pdf.setAuthor(content.candidate.fullName);
  pdf.setSubject(`${content.target.jobTitle} at ${content.target.employer}`);
  const regular = await pdf.embedFont(style.type === "traditional" ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const bold = await pdf.embedFont(style.type === "modern" ? StandardFonts.HelveticaBold : StandardFonts.TimesRomanBold);
  const width = 612;
  const height = 792;
  const margin = compact ? 40 : 48;
  const rail = sidebar ? 196 : 0;
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const paintPage = () => {
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    if (sidebar) page.drawRectangle({ x: 0, y: 0, width: rail + 18, height, color: accent });
  };
  paintPage();

  const contentX = () => margin + (sidebar ? rail : 0);
  const contentWidth = () => width - margin - contentX();
  const wrap = (value: string, font: PDFFont, size: number, available: number) => {
    const output: string[] = [];
    const words = safeText(value).split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      if (font.widthOfTextAtSize(word, size) > available) {
        if (line) { output.push(line); line = ""; }
        let chunk = "";
        for (const char of word) {
          const next = chunk + char;
          if (font.widthOfTextAtSize(next, size) <= available) chunk = next;
          else { if (chunk) output.push(chunk); chunk = char; }
        }
        line = chunk;
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= available || !line) line = candidate;
      else { output.push(line); line = word; }
    }
    if (line) output.push(line);
    return output.length ? output : [""];
  };
  const newPage = () => {
    page = pdf.addPage([width, height]);
    paintPage();
    y = height - margin;
  };
  const ensure = (needed: number) => { if (y - needed < margin) newPage(); };
  const write = (value: string, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof pdfColor>; x?: number; available?: number; gap?: number; align?: "left" | "center" | "right" }) => {
    const font = options.font ?? regular;
    const size = options.size ?? (compact ? 9 : 10);
    const available = options.available ?? contentWidth();
    const origin = options.x ?? contentX();
    const color = options.color ?? ink;
    const lineHeight = size + 3;
    for (const line of wrap(value, font, size, available)) {
      ensure(lineHeight);
      const lineWidth = font.widthOfTextAtSize(line, size);
      const x = options.align === "center" ? origin + (available - lineWidth) / 2 : options.align === "right" ? origin + available - lineWidth : origin;
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    }
    y -= options.gap ?? 2;
  };
  const rule = () => {
    ensure(8);
    page.drawLine({ start: { x: contentX(), y }, end: { x: width - margin, y }, thickness: 1, color: accent });
    y -= 12;
  };
  const heading = (label: string) => {
    ensure(22);
    y -= 6;
    write(label.toUpperCase(), { font: bold, size: compact ? 8 : 9, color: accent, gap: 2 });
    rule();
  };

  const drawHeader = () => {
    const meta = [content.target.jobTitle, content.candidate.location, content.target.employer].filter(Boolean).join(" · ");
    if (style.header === "band") {
      const bandHeight = compact ? 72 : 88;
      page.drawRectangle({ x: sidebar ? rail + 18 : 0, y: height - bandHeight, width: width - (sidebar ? rail + 18 : 0), height: bandHeight, color: accent });
      y = height - 28;
      write(content.candidate.fullName, { font: bold, size: compact ? 16 : 20, color: bandText, gap: 2, x: contentX(), available: contentWidth() });
      write(content.candidate.headline, { size: 9, color: bandText, gap: 1 });
      const contact = contactText(content);
      if (contact) write(contact, { size: 8, color: bandText, gap: 1 });
      write(meta, { size: 8, color: bandText, gap: 4 });
      y = Math.min(y, height - bandHeight - 16);
      return;
    }
    const align = style.header === "center" ? "center" as const : "left" as const;
    write(content.candidate.fullName, { font: bold, size: compact ? 16 : style.layout === "executive" ? 22 : 18, gap: 2, align });
    write(content.candidate.headline, { size: 9, color: muted, gap: 2, align });
    const contact = contactText(content);
    if (contact) write(contact, { size: 8, color: muted, gap: 2, align });
    if (style.header === "split") {
      write(content.target.jobTitle, { size: 8, color: muted, gap: 0, align: "left" });
      write([content.candidate.location, content.target.employer].filter(Boolean).join(" · "), { size: 8, color: muted, gap: 4 });
    } else {
      write(meta, { size: 8, color: muted, gap: 4, align });
    }
    rule();
  };

  if (sidebar) {
    let railY = height - 36;
    const railWrite = (value: string, size: number, font: PDFFont, gap = 3) => {
      for (const line of wrap(value, font, size, rail - 16)) {
        page.drawText(line, { x: 16, y: railY, size, font, color: bandText });
        railY -= size + 3;
      }
      railY -= gap;
    };
    if (style.header !== "band") {
      railWrite(content.candidate.fullName, 12, bold, 3);
      railWrite(style.header === "split" ? content.candidate.headline : content.target.jobTitle, 8, regular, 3);
      if (content.candidate.email) railWrite(content.candidate.email, 7.5, regular, 1);
      if (content.candidate.phone) railWrite(content.candidate.phone, 7.5, regular, 1);
      if (content.candidate.linkedin) railWrite(content.candidate.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), 7.5, regular, 2);
      if (content.candidate.location) railWrite(content.candidate.location, 8, regular, 6);
    }
    railWrite("SKILLS", 8, bold, 4);
    for (const group of content.skillGroups) {
      railWrite(categoryLabel(group.category), 8, bold, 1);
      railWrite(group.skills.map((skill) => skill.name).join(", "), 7.5, regular, 4);
    }
    railWrite("EDUCATION", 8, bold, 4);
    for (const item of content.education) {
      railWrite(item.degree, 8, bold, 1);
      railWrite(item.institution, 7.5, regular, 4);
    }
    if (content.credentials.length) {
      railWrite("CREDENTIALS", 8, bold, 4);
      for (const item of content.credentials) railWrite(item.name, 8, regular, 2);
    }
    y = height - (style.header === "band" ? 28 : margin);
    if (style.header === "band") drawHeader();
    else if (style.header === "split") write(`${content.target.jobTitle} · ${content.target.employer}`, { size: 8, color: muted, gap: 8 });
  } else {
    drawHeader();
  }

  heading(style.layout === "executive" ? "Profile" : "Summary");
  write(content.summary, { size: compact ? 8.5 : 10, gap: 4 });
  if (compact) {
    const skills = content.skillGroups.flatMap((group) => group.skills.map((skill) => skill.name));
    if (skills.length) write(`Skills: ${skills.join(" · ")}`, { size: 8, gap: 6 });
  }
  heading("Experience");
  for (const experience of content.experiences) {
    write(experience.title ?? "Role", { font: bold, size: compact ? 10 : 11, gap: 0 });
    write(`${experience.employer}${experience.client ? ` · ${experience.client}` : ""}${experience.location ? ` · ${experience.location}` : ""} · ${dates(experience)}`, { size: 8, color: muted, gap: 2 });
    for (const bullet of experience.bullets) write(`• ${bullet}`, { size: compact ? 8.5 : 9.5, gap: 1 });
    y -= 4;
  }
  if (!compact && content.projects.length) {
    heading("Projects");
    for (const project of content.projects) {
      write(project.name, { font: bold, size: 11, gap: 1 });
      for (const bullet of project.bullets) write(`• ${bullet}`, { size: 9.5, gap: 1 });
      y -= 3;
    }
  }
  if (!sidebar) {
    heading("Skills");
    for (const group of content.skillGroups) write(`${categoryLabel(group.category)}: ${group.skills.map((skill) => skill.name).join(", ")}`, { size: compact ? 8 : 9.5, gap: 1 });
    heading("Education");
    for (const item of content.education) write(`${item.degree}${item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""} — ${item.institution}`, { size: compact ? 8.5 : 10, gap: 1 });
    if (content.credentials.length) {
      heading("Credentials");
      for (const item of content.credentials) write(`• ${item.name}`, { size: compact ? 8.5 : 10, gap: 1 });
    }
  }
  return Buffer.from(await pdf.save());
}

function run(text: string, options: { bold?: boolean; size?: number; color?: string; font: string; italics?: boolean }) {
  return new TextRun({ text: safeText(text), bold: options.bold, italics: options.italics, size: options.size ?? 20, color: options.color, font: options.font });
}

export async function renderTargetResumeDocx(content: TargetResumeContent, style: TargetExportStyle) {
  const palette = palettes[style.color];
  const accent = hex(palette.accent);
  const ink = hex(palette.ink);
  const muted = hex(palette.muted);
  const bandText = hex(palette.bandText);
  const bodyFont = style.type === "traditional" ? "Georgia" : "Calibri";
  const headingFont = style.type === "modern" ? "Calibri" : "Georgia";
  const compact = style.layout === "compact";
  const center = style.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const heading = (label: string) => new Paragraph({
    spacing: { before: compact ? 140 : 200, after: 60 },
    border: { bottom: { color: accent, style: BorderStyle.SINGLE, size: 8, space: 1 } },
    children: [run(label.toUpperCase(), { bold: true, size: compact ? 16 : 18, color: accent, font: headingFont })]
  });
  const bullet = (text: string) => new Paragraph({ style: "ResumeBullet", spacing: { after: 40 }, children: [run(text, { size: compact ? 18 : 20, color: ink, font: bodyFont })] });
  const headerBlocks: Paragraph[] = [];
  const meta = [content.target.jobTitle, content.candidate.location, content.target.employer].filter(Boolean).join(" · ");
  const name = new Paragraph({
    alignment: center,
    shading: style.header === "band" ? { type: ShadingType.CLEAR, fill: accent } : undefined,
    spacing: { after: 40 },
    children: [run(content.candidate.fullName, { bold: true, size: compact ? 32 : 40, color: style.header === "band" ? bandText : accent, font: headingFont })]
  });
  const headline = new Paragraph({
    alignment: center,
    shading: style.header === "band" ? { type: ShadingType.CLEAR, fill: accent } : undefined,
    spacing: { after: 40 },
    children: [run(content.candidate.headline, { size: 20, color: style.header === "band" ? bandText : muted, font: bodyFont })]
  });
  headerBlocks.push(name, headline);
  const contact = contactText(content);
  if (contact) {
    headerBlocks.push(new Paragraph({
      alignment: center,
      shading: style.header === "band" ? { type: ShadingType.CLEAR, fill: accent } : undefined,
      spacing: { after: 40 },
      children: [run(contact, { size: 18, color: style.header === "band" ? bandText : muted, font: bodyFont })]
    }));
  }
  if (style.header === "split") {
    headerBlocks.push(new Paragraph({ spacing: { after: 80 }, children: [run(content.target.jobTitle, { size: 18, color: muted, font: bodyFont })] }));
    headerBlocks.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { color: accent, style: BorderStyle.SINGLE, size: 12, space: 1 } }, children: [run([content.candidate.location, content.target.employer].filter(Boolean).join(" · "), { size: 18, color: muted, font: bodyFont })] }));
  } else {
    headerBlocks.push(new Paragraph({
      alignment: center,
      shading: style.header === "band" ? { type: ShadingType.CLEAR, fill: accent } : undefined,
      spacing: { after: 120 },
      border: style.header === "band" ? undefined : { bottom: { color: accent, style: BorderStyle.SINGLE, size: 12, space: 1 } },
      children: [run(meta, { size: 18, color: style.header === "band" ? bandText : muted, font: bodyFont })]
    }));
  }
  const main: Paragraph[] = [
    ...headerBlocks,
    heading(style.layout === "executive" ? "Profile" : "Summary"),
    new Paragraph({ spacing: { after: 80 }, children: [run(content.summary, { size: compact ? 18 : 20, color: ink, font: bodyFont })] })
  ];
  if (compact) {
    const skills = content.skillGroups.flatMap((group) => group.skills.map((skill) => skill.name));
    if (skills.length) main.push(new Paragraph({ spacing: { after: 80 }, children: [run(`Skills: ${skills.join(" · ")}`, { size: 18, color: ink, font: bodyFont })] }));
  }
  main.push(heading("Experience"));
  for (const experience of content.experiences) {
    main.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [run(experience.title ?? "Role", { bold: true, size: 22, color: accent, font: headingFont })] }));
    main.push(new Paragraph({ spacing: { after: 40 }, children: [run(`${experience.employer}${experience.location ? ` · ${experience.location}` : ""} · ${dates(experience)}`, { size: 18, color: muted, italics: true, font: bodyFont })] }));
    for (const item of experience.bullets) main.push(bullet(item));
  }
  if (!compact && content.projects.length) {
    main.push(heading("Projects"));
    for (const project of content.projects) {
      main.push(new Paragraph({ spacing: { before: 60, after: 20 }, children: [run(project.name, { bold: true, size: 22, color: accent, font: headingFont })] }));
      for (const item of project.bullets) main.push(bullet(item));
    }
  }
  const sideColor = style.layout === "sidebar" ? bandText : ink;
  const sideHeading = (label: string) => new Paragraph({
    spacing: { before: compact ? 120 : 180, after: 50 },
    children: [run(label.toUpperCase(), { bold: true, size: compact ? 16 : 18, color: style.layout === "sidebar" ? bandText : accent, font: headingFont })]
  });
  const side: Paragraph[] = [
    sideHeading("Skills"),
    ...content.skillGroups.map((group) => new Paragraph({ spacing: { after: 40 }, children: [run(`${categoryLabel(group.category)}: ${group.skills.map((skill) => skill.name).join(", ")}`, { size: 18, color: sideColor, font: bodyFont })] })),
    sideHeading("Education"),
    ...content.education.map((item) => new Paragraph({ spacing: { after: 40 }, children: [run(`${item.degree}${item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""} — ${item.institution}`, { size: 18, color: sideColor, font: bodyFont })] })),
    ...(content.credentials.length ? [sideHeading("Credentials"), ...content.credentials.map((item) => new Paragraph({ spacing: { after: 40 }, children: [run(item.name, { size: 18, color: sideColor, font: bodyFont })] }))] : [])
  ];
  if (style.layout !== "sidebar") main.push(...side);
  const children = style.layout === "sidebar"
    ? [new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        cantSplit: false,
        children: [
          new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: accent }, margins: { top: 120, bottom: 120, left: 120, right: 120 }, children: side }),
          new TableCell({ width: { size: 72, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 160, right: 80 }, children: main })
        ]
      })]
    })]
    : main;
  const document = new Document({
    styles: {
      default: { document: { run: { font: bodyFont, size: 20, color: ink } } },
      paragraphStyles: [{ id: "ResumeBullet", name: "Resume Bullet", basedOn: "Normal", quickFormat: true, paragraph: { numbering: { reference: "resume-bullets", level: 0 } } }]
    },
    numbering: { config: [{ reference: "resume-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 180 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 620, right: 720, bottom: 620, left: 720 } } }, children }]
  });
  return Buffer.from(await Packer.toBuffer(document));
}
