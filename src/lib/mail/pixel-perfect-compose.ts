import { emailDesignFilename } from "@/lib/mail/email-design-constants";
import { renderEmailDocumentToPng } from "@/lib/mail/pixel-perfect-render";

export async function attachPixelPerfectImage(data: FormData, frame: HTMLIFrameElement | null, mode: "standard" | "pixel-perfect") {
  data.set("renderMode", mode);
  if (mode !== "pixel-perfect") return;
  if (!frame) throw new Error("The recipient preview is still loading. Try again in a moment.");

  const snapshotFrame = window.document.createElement("iframe");
  snapshotFrame.setAttribute("sandbox", "allow-same-origin");
  snapshotFrame.setAttribute("aria-hidden", "true");
  snapshotFrame.tabIndex = -1;
  snapshotFrame.style.cssText = "position:fixed;left:-10000px;top:0;width:624px;height:600px;border:0;visibility:hidden;pointer-events:none";
  snapshotFrame.srcdoc = frame.srcdoc;
  window.document.body.appendChild(snapshotFrame);

  try {
    if (snapshotFrame.contentDocument?.readyState !== "complete") {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The recipient preview is still loading. Try again in a moment.")), 15_000);
        snapshotFrame.addEventListener("load", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
      });
    }

    const image = await renderEmailDocumentToPng(snapshotFrame);
    data.set("pixelPerfectImage", new File([image], emailDesignFilename, { type: "image/png" }));
  } finally {
    snapshotFrame.remove();
  }
}
