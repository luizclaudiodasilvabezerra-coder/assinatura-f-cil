import { base44 } from "@/api/base44Client";
import { base64ToBlob } from "@/lib/pdfDownload";

export const loteDoArquivo = (lotes, url) => {
  if (!lotes || !lotes.length || !url) return null;
  return lotes.find((l) => Array.isArray(l.arquivos) && l.arquivos.includes(url)) || null;
};

export const carimbarEUploadar = async ({ fileUrl, imagemUrl, pos, nome, observacao, operacao, unidade, indent, lado, autoPosition, prefixo = "assinado" }) => {
  if (!fileUrl || !/\.pdf$/i.test(fileUrl)) return fileUrl;
  const stampRes = await base44.functions.invoke("carimbarPdf", {
    fileUrl, imagemUrl, posX: pos.x, posY: pos.y, autoPosition, lado,
    nome, data: new Date().toLocaleString("pt-BR"),
    observacao, operacao, unidade, indent,
  });
  if (!stampRes.data?.pdf_base64) throw new Error(stampRes.data?.error || "Falha ao carimbar");
  const nomeArquivo = decodeURIComponent((fileUrl.split("/").pop() || "arquivo.pdf"));
  const stampedFile = new File([base64ToBlob(stampRes.data.pdf_base64)], `${prefixo}_${nomeArquivo}`, { type: "application/pdf" });
  const up = await base44.integrations.Core.UploadFile({ file: stampedFile });
  return up.file_url;
};