import { emailDesignImageMaxBytes } from "@/lib/mail/email-design-constants";

const EMAIL_CANVAS_WIDTH = 624;
const EMAIL_CANVAS_SCALE = 2;
const MAX_EMAIL_CANVAS_HEIGHT = 8_000;

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The email image could not be read."));
    reader.onerror = () => reject(new Error("The email image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function imageLoaded(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("A design image could not be loaded.")), { once: true });
  });
}

/** Captures the same email-safe document shown in the composer as a 2x PNG. */
export async function renderEmailDocumentToPng(frame: HTMLIFrameElement) {
  const emailDocument = frame.contentDocument;
  if (!emailDocument?.body) throw new Error("The email preview is still loading. Try again in a moment.");

  await emailDocument.fonts?.ready;
  const sourceImages = [...emailDocument.images];
  await Promise.all(sourceImages.map(imageLoaded));

  const width = EMAIL_CANVAS_WIDTH;
  const height = Math.ceil(Math.max(emailDocument.body.scrollHeight, emailDocument.documentElement.scrollHeight));
  if (height < 1 || height > MAX_EMAIL_CANVAS_HEIGHT) {
    throw new Error(`Pixel Perfect images support messages up to ${MAX_EMAIL_CANVAS_HEIGHT.toLocaleString()} pixels tall. Shorten the message and try again.`);
  }

  const clonedBody = emailDocument.body.cloneNode(true) as HTMLBodyElement;
  const clonedImages = [...clonedBody.querySelectorAll("img")];
  await Promise.all(sourceImages.map(async (image, index) => {
    const source = image.currentSrc || image.src;
    if (!source || source.startsWith("data:")) return;
    const response = await fetch(source, { credentials: "same-origin" });
    if (!response.ok) throw new Error("A design image could not be prepared for the email.");
    clonedImages[index].src = await blobAsDataUrl(await response.blob());
  }));

  const bodyMarkup = clonedBody.innerHTML
    .replace(/&nbsp;/gi, "&#160;")
    .replace(/<(br|img)(\b[^>]*?)(?<!\/)\s*>/gi, "<$1$2 />");
  const bodyBackground = emailDocument.body.getAttribute("bgcolor") || "#ffffff";
  const bodyStyle = emailDocument.body.getAttribute("style") || "";
  const markup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${width}px;height:${height}px;overflow:hidden;background-color:${bodyBackground};${bodyStyle}">${bodyMarkup}</div>
  </foreignObject>
</svg>`;

  const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const rendered = new Image();
    rendered.src = svgUrl;
    await rendered.decode();

    const canvas = window.document.createElement("canvas");
    canvas.width = width * EMAIL_CANVAS_SCALE;
    canvas.height = height * EMAIL_CANVAS_SCALE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the Pixel Perfect image.");
    context.scale(EMAIL_CANVAS_SCALE, EMAIL_CANVAS_SCALE);
    context.drawImage(rendered, 0, 0, width, height);

    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!image) throw new Error("Your browser could not export the Pixel Perfect image.");
    if (image.size > emailDesignImageMaxBytes) throw new Error("This Pixel Perfect image is over 8 MB. Shorten the message or use Standard HTML mode.");
    return image;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
