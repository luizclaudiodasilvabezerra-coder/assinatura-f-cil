import { base44 } from "@/api/base44Client";

export async function verificarArquivosEnvelope(arquivos, hashMap) {
  const response = await base44.functions.invoke("verificarDuplicidadeNF", {
    arquivos: arquivos.map((url) => ({ url, hash: hashMap[url] || "" })),
  });
  const data = response.data;
  if (data?.ok !== true || !Array.isArray(data.resultados) || !Array.isArray(data.duplicidades) ||
      data.resultados.length !== arquivos.length ||
      arquivos.some((url) => !data.resultados.some((item) => item.arquivo === url))) {
    throw new Error("Não foi possível concluir a verificação de duplicidade. Nenhum envelope foi criado; tente novamente.");
  }
  return data;
}