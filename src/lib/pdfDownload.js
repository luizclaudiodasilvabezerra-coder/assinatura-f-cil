import { base44 } from "@/api/base44Client";

export function base64ToBlob(b64, mime = "application/pdf") {
  const byteChars = atob(b64);
  const len = byteChars.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function baixarEnvelopePdf(documentoId, nomeArquivo = "envelope.pdf") {
  const res = await base44.functions.invoke("baixarEnvelope", { documentoId });
  if (res.data?.pdf_base64) {
    downloadBlob(base64ToBlob(res.data.pdf_base64), nomeArquivo);
    return true;
  }
  throw new Error(res.data?.error || "Falha ao gerar PDF do envelope");
}

export async function baixarArquivoPdf(arquivoUrl, nomeArquivo = "arquivo.pdf") {
  const resp = await fetch(arquivoUrl);
  const blob = await resp.blob();
  downloadBlob(blob, nomeArquivo);
}