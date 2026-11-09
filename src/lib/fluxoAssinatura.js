import { isRedirectTarget, signatarioRedirecionado } from "@/lib/redirecionamentoAssinatura";

export const etapaGestao = (doc) => signatarioRedirecionado(doc?.signatario_nome) ? "gestao_origem" : "signatario";
export const precisaAutorizacao = (doc) => !!isRedirectTarget(doc?.signatario_nome);
export const precisaHierarquia = (doc) => !!(doc?.fluxo_hierarquico || signatarioRedirecionado(doc?.signatario_nome) || precisaAutorizacao(doc));
export const assinaturasGestaoAtivas = (doc, sigs) => (doc?.arquivos || []).map((url) => sigs.find((s) =>
  s.etapa === "signatario" && s.status === "assinado" && s.arquivo_url && (s.arquivo_original_url || s.arquivo_url) === url
)).filter(Boolean);
export const mapaAssinaturas = (doc, sigs, etapaForcada) => {
  const etapaAlvo = etapaForcada || etapaGestao(doc);
  const map = {};
  (doc?.arquivos || []).forEach((url, i) => {
    // Casa pelo original e também pelo arquivo já carimbado (após o encaminhamento
    // ao gestor, o envelope passa a apontar para as versões assinadas).
    const sig = sigs.find((s) => (s.etapa || "signatario") === etapaAlvo && s.status === "assinado" &&
      ((s.arquivo_original_url || s.arquivo_url) === url || s.arquivo_url === url) && !s.observacao?.startsWith("Assinatura automática"));
    if (sig) map[i] = sig;
  });
  return map;
};
export const encaminharEnvelope = async (documentoId, parcial = false) => {
  const { base44 } = await import("@/api/base44Client");
  const { data } = await base44.functions.invoke("encaminharEnvelope", { documentoId, parcial });
  if (!data?.documento) throw new Error(data?.error || "Não foi possível encaminhar o envelope.");
  return data.documento;
};