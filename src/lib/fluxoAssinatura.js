import { isRedirectTarget, signatarioRedirecionado } from "@/lib/redirecionamentoAssinatura";

export const etapaGestao = (doc) => signatarioRedirecionado(doc?.signatario_nome) ? "gestao_origem" : "signatario";
export const precisaAutorizacao = (doc) => !!isRedirectTarget(doc?.signatario_nome);
export const precisaHierarquia = (doc) => !!(doc?.fluxo_hierarquico || signatarioRedirecionado(doc?.signatario_nome) || precisaAutorizacao(doc));
// Chave da página: o nome do arquivo muda a cada carimbo, reconstrução ou renomeação
// (assinado_, legivel_, reconstruido_ e o hash do upload se acumulam), então
// comparamos sempre o nome "limpo" para identificar a mesma página.
const chaveArquivo = (url) => {
  if (!url) return "";
  let nome = String(url).split("/").pop() || "";
  try { nome = decodeURIComponent(nome); } catch { /* mantém */ }
  nome = nome.toLowerCase();
  for (let anterior = ""; anterior !== nome;) {
    anterior = nome;
    nome = nome.replace(/^[0-9a-f]{8,10}_/i, "").replace(/^(assinado|legivel|reconstruido|reassinar|carimbado|copia)_/i, "");
  }
  return nome;
};

export { chaveArquivo };

const mesmaPagina = (sig, url) => {
  const alvo = chaveArquivo(url);
  return !!alvo && (chaveArquivo(sig.arquivo_original_url || sig.arquivo_url) === alvo || chaveArquivo(sig.arquivo_url) === alvo);
};

// Envelopes cujo gestor é Joselio Serur exigem a autorização dele em cada página.
// A assinatura feita pelo signatário de origem (Matheus, Ana, Anderson) na etapa
// "signatario" não conclui a página para o gestor.
const ehDoGestorAtual = (doc, s) => {
  const email = (doc?.signatario_email || "").trim().toLowerCase();
  const nome = (doc?.signatario_nome || "").trim().toUpperCase();
  const sEmail = (s.assinante_email || "").trim().toLowerCase();
  const sNome = (s.assinante_nome || "").trim().toUpperCase();
  return (!!email && sEmail === email) || (!!nome && sNome === nome);
};
const valeParaGestor = (doc, s, etapaAlvo) =>
  etapaAlvo !== "signatario" || !precisaAutorizacao(doc) || ehDoGestorAtual(doc, s);

export const assinaturasGestaoAtivas = (doc, sigs) => (doc?.arquivos || []).map((url) => sigs.find((s) =>
  s.etapa === "signatario" && s.status === "assinado" && s.arquivo_url && mesmaPagina(s, url) &&
  valeParaGestor(doc, s, "signatario")
)).filter(Boolean);
export const mapaAssinaturas = (doc, sigs, etapaForcada) => {
  const etapaAlvo = etapaForcada || etapaGestao(doc);
  const map = {};
  (doc?.arquivos || []).forEach((url, i) => {
    const sig = sigs.find((s) => (s.etapa || "signatario") === etapaAlvo && s.status === "assinado" &&
      s.arquivo_url && mesmaPagina(s, url) && !s.observacao?.startsWith("Assinatura automática") &&
      valeParaGestor(doc, s, etapaAlvo));
    if (sig) map[i] = sig;
  });
  return map;
};
export const encaminharEnvelope = async (documentoId, parcial = false) => {
  const { base44 } = await import("@/api/base44Client");
  try {
    const { data } = await base44.functions.invoke("encaminharEnvelope", { documentoId, parcial });
    if (!data?.documento) throw new Error(data?.error || "Não foi possível encaminhar o envelope.");
    return data.documento;
  } catch (e) {
    // Mostra o motivo real devolvido pelo servidor (ex.: página sem assinatura/autorização)
    const motivo = e?.response?.data?.error || e?.data?.error;
    const msg = motivo || (e?.message && !/status code/i.test(e.message) ? e.message : "");
    throw new Error(msg || "Não foi possível encaminhar o envelope. Confira as assinaturas e a autorização.");
  }
};