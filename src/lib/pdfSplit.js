import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { jsPDF } from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Recebe um File e retorna um array de File(s).
 * Se for um PDF com múltiplas páginas, divide cada página em um PDF individual.
 * Caso contrário, retorna o arquivo original dentro de um array.
 */
export async function splitPdfIfNeeded(file) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return [file];

  let pdf;
  try {
    const arrayBuffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/",
    }).promise;

    if (pdf.numPages <= 1) return [file];

    const baseName = file.name.replace(/\.pdf$/i, "");
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const orientation = viewport.width > viewport.height ? "landscape" : "portrait";
      const pdfDoc = new jsPDF({
        orientation,
        unit: "px",
        format: [viewport.width, viewport.height],
      });
      pdfDoc.addImage(imgData, "JPEG", 0, 0, viewport.width, viewport.height);
      const blob = pdfDoc.output("blob");
      pages.push(
        new File([blob], `${baseName}-pag-${i}.pdf`, { type: "application/pdf" })
      );
    }
    return pages;
  } catch (err) {
    console.error("[pdfSplit] Erro ao dividir PDF:", err);
    return [file];
  } finally {
    if (pdf) {
      try { await pdf.destroy(); } catch {}
    }
  }
}