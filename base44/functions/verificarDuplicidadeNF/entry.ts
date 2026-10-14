import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Verifica duplicidade de NF/boleto: extrai o número de cada novo arquivo e procura
// ocorrências já existentes em envelopes assinados (RelatorioNF) ou pendentes (Documento.numeros_nf).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const arquivos: string[] = Array.isArray(body?.arquivos) ? body.arquivos.filter(Boolean) : [];
    if (arquivos.length === 0) return Response.json({ error: 'arquivos obrigatórios' }, { status: 400 });

    // 1) Extrai o número da NF/boleto de cada arquivo anexado (em paralelo).
    const resultados = await Promise.all(arquivos.map(async (arquivoUrl) => {
      let numero_nf = '';
      let emitente = '';
      try {
        const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Analise este documento (Nota Fiscal ou boleto) e extraia:
- numero_nf: número da Nota Fiscal ou do boleto (apenas dígitos, sem símbolos. Se não encontrar, retorne null)
- emitente: nome ou razão social do emitente
Retorne APENAS o JSON.`,
          file_urls: [arquivoUrl],
          response_json_schema: {
            type: 'object',
            properties: {
              numero_nf: { type: 'string' },
              emitente: { type: 'string' }
            }
          }
        });
        numero_nf = (extracted?.numero_nf || '').toString().trim();
        emitente = (extracted?.emitente || '').toString().trim();
        if (numero_nf.toLowerCase() === 'null') numero_nf = '';
      } catch {
        // Mantém numero_nf vazio — não bloqueia a criação.
      }
      return { arquivo: arquivoUrl, numero_nf, emitente };
    }));

    const numeros = resultados.map((r) => r.numero_nf).filter((n) => n && n.length >= 3);
    const duplicidades: any[] = [];

    if (numeros.length) {
      // 2a) Envelopes já assinados/processados (RelatorioNF).
      let rel: any[] = [];
      try {
        rel = await base44.asServiceRole.entities.RelatorioNF.filter(
          { numero_nf: { $in: numeros } }, '-created_date', 200
        );
      } catch {
        // Se a consulta falhar, segue apenas com a fonte de pendentes.
      }

      // 2b) Envelopes pendentes (índice numeros_nf no Documento).
      let docs: any[] = [];
      try {
        docs = await base44.asServiceRole.entities.Documento.filter(
          { numeros_nf: { $in: numeros } }, '-created_date', 200
        );
      } catch {
        // Mesma ressalva.
      }

      // 3) Monta a crítica: para cada número novo, aponta o documento/página existente.
      for (const r of resultados) {
        if (!r.numero_nf) continue;
        for (const rn of rel) {
          if (rn.numero_nf === r.numero_nf) {
            duplicidades.push({
              arquivo_novo: r.arquivo,
              numero_nf: r.numero_nf,
              existente_documento_titulo: rn.documento_titulo || '',
              existente_arquivo: rn.arquivo_url || '',
              existente_documento_id: rn.documento_id || '',
              existente_numero: '',
              existente_status: 'assinado'
            });
          }
        }
        for (const d of docs) {
          for (const an of (d.arquivos_nf || [])) {
            if (an && an.numero_nf === r.numero_nf) {
              duplicidades.push({
                arquivo_novo: r.arquivo,
                numero_nf: r.numero_nf,
                existente_documento_titulo: d.titulo || '',
                existente_arquivo: an.arquivo || '',
                existente_documento_id: d.id || '',
                existente_numero: d.numero || '',
                existente_status: d.status || ''
              });
            }
          }
        }
      }
    }

    return Response.json({ ok: true, resultados, duplicidades });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}