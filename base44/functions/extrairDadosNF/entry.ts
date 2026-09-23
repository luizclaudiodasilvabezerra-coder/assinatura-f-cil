import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const documentoId = body?.documento_id;
    if (!documentoId) return Response.json({ error: 'documento_id obrigatorio' }, { status: 400 });

    let doc;
    try {
      doc = await base44.asServiceRole.entities.Documento.get(documentoId);
    } catch {
      return Response.json({ error: 'Documento nao encontrado' }, { status: 404 });
    }

    // Busca assinaturas da diretoria (arquivos finais assinados)
    const assinaturasMaster = await base44.asServiceRole.entities.Assinatura.filter({
      documento_id: documentoId, etapa: "master", status: "assinado"
    }, "-created_date", 200);

    // Se nao houver assinaturas da diretoria, busca as do gestor (signatario)
    let assinaturas;
    if (assinaturasMaster.length > 0) {
      assinaturas = assinaturasMaster;
    } else {
      assinaturas = await base44.asServiceRole.entities.Assinatura.filter({
        documento_id: documentoId, etapa: "signatario", status: "assinado"
      }, "-created_date", 200);
    }

    // Usa os arquivos assinados; se nao houver, cai para os arquivos originais
    const signedUrls = assinaturas.map((a) => a.arquivo_url).filter(Boolean);
    const arquivos = signedUrls.length > 0 ? signedUrls : (doc.arquivos || []);

    if (arquivos.length === 0) return Response.json({ ok: true, extracted: 0, results: [] });

    const results = [];
    for (const arquivoUrl of arquivos) {
      // Pula se ja foi extraido
      const existing = await base44.asServiceRole.entities.RelatorioNF.filter({
        documento_id: documentoId, arquivo_url: arquivoUrl
      }, "-created_date", 5);
      if (existing.length > 0) { results.push(existing[0]); continue; }

      // Extrai dados da NF via IA
      let emitente = "";
      let valor_total = 0;
      let valor_boleto = 0;
      let data_emissao = "";
      let numero_nf = "";

      try {
        const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Analise esta Nota Fiscal e extraia as seguintes informacoes:
- numero_nf: numero da Nota Fiscal (apenas digitos, sem simbolos. Se nao encontrar, retorne null)
- emitente: nome ou razao social do emitente da NF
- valor_boleto: valor do boleto bancario como numero (apenas digitos e ponto decimal, sem simbolos monetarios. Se nao houver boleto, retorne 0)
- valor_total: valor total da NF como numero (apenas digitos e ponto decimal, sem simbolos monetarios)
- data_emissao: data de emissao da NF no formato YYYY-MM-DD (se nao encontrar, retorne null)

Retorne APENAS o JSON.`,
          file_urls: [arquivoUrl],
          response_json_schema: {
            type: "object",
            "properties": {
              numero_nf: { type: "string" },
              emitente: { type: "string" },
              valor_boleto: { type: "number" },
              valor_total: { type: "number" },
              data_emissao: { type: "string" }
            }
          }
        });
        numero_nf = (extracted?.numero_nf || "").toString();
        emitente = (extracted?.emitente || "").toString();
        valor_boleto = Number(extracted?.valor_boleto) || 0;
        valor_total = Number(extracted?.valor_total) || 0;
        data_emissao = (extracted?.data_emissao || "").toString();
      } catch {
        // Se falhar a extracao, registra com dados vazios para tentar depois
      }

      const record = await base44.asServiceRole.entities.RelatorioNF.create({
        documento_id: documentoId,
        documento_titulo: doc.titulo || "",
        arquivo_url: arquivoUrl,
        numero_nf,
        emitente,
        valor_boleto,
        valor_total,
        data_emissao,
        unidade_negocio: doc.unidade_negocio || "",
        gestor: doc.signatario_nome || "",
        diretoria: doc.diretoria || "",
        data_assinatura: new Date().toISOString(),
      });
      results.push(record);
    }

    return Response.json({ ok: true, extracted: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}