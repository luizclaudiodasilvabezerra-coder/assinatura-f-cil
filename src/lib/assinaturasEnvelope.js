import { base44 } from "@/api/base44Client";

export default async function carregarAssinaturasEnvelope(documentoId, etapas) {
  const assinaturas = [];
  let cursor;
  do {
    const page = await base44.entities.Assinatura.filter({ documento_id: documentoId, status: "assinado", etapa: { $in: etapas } }, { sort: "-created_date", limit: 100, cursor });
    assinaturas.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return assinaturas;
}