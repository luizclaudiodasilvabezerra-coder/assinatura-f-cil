import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

type ArquivoIn = { url: string; hash?: string } | string;

const norm = (a: ArquivoIn) => (typeof a === 'string' ? { url: a, hash: '' } : { url: a.url, hash: a.hash || '' });

// Verifica duplicidade de NF/boleto por três critérios, do mais ao menos confiável:
// 1) hash do conteúdo do arquivo (mesmo arquivo reenviado) — determinístico;
// 2) mesma URL de arquivo (reuso do mesmo upload);
// 3) mesmo número de NF (extraído via IA) — melhor esforço.
// Consulta envelopes pendentes (Documento) e assinados (RelatorioNF).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const arquivos = (Array.isArray(body?.arquivos) ? body.arquivos.filter(Boolean) : []).map(norm);
    if (arquivos.length === 0) return Response.json({ error: 'arquivos obrigatórios' }, { status: 400 });

    // 1) Extrai numero_nf por arquivo (IA, melhor esforço). O hash já vem do cliente.
    const resultados = await Promise.all(arquivos.map(async (a) => {
      let numero_nf = '';
      let emitente = '';
      try {
        const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Analise este documento (Nota Fiscal ou boleto) e extraia:
- numero_nf: número da Nota Fiscal ou do boleto (apenas dígitos, sem símbolos. Se não encontrar, retorne null)
- emitente: nome ou razão social do emitente
Retorne APENAS o JSON.`,
          file_urls: [a.url],
          response_json_schema: {
            type: 'object',
            properties: { numero_nf: { type: 'string' }, emitente: { type: 'string' } }
          }
        });
        numero_nf = (extracted?.numero_nf || '').toString().trim();
        emitente = (extracted?.emitente || '').toString().trim();
        if (numero_nf.toLowerCase() === 'null') numero_nf = '';
      } catch {
        // Sem numero_nf — a deteção por hash/URL ainda funciona.
      }
      return { arquivo: a.url, hash: a.hash, numero_nf, emitente };
    }));

    const numeros = resultados.map((r) => r.numero_nf).filter((n) => n && n.length >= 3);
    const hashes = resultados.map((r) => r.hash).filter(Boolean);
    const urls = resultados.map((r) => r.arquivo).filter(Boolean);

    // 2) Envelopes pendentes que compartilham hash, URL ou numero_nf com os novos arquivos.
    const docsMap = new Map<string, any>();
    const buscar = async (query: any) => {
      try {
        const res = await base44.asServiceRole.entities.Documento.filter(query, '-created_date', 200);
        res.forEach((d) => docsMap.set(d.id, d));
      } catch {
        // Consulta não suportada — segue com as demais.
      }
    };
    if (hashes.length) await buscar({ arquivos_hash: { $in: hashes } });
    if (urls.length) await buscar({ arquivos: { $in: urls } });
    if (numeros.length) await buscar({ numeros_nf: { $in: numeros } });
    const docs = Array.from(docsMap.values());

    // 3) Envelopes assinados (RelatorioNF) por numero_nf.
    let rel: any[] = [];
    if (numeros.length) {
      try {
        rel = await base44.asServiceRole.entities.RelatorioNF.filter({ numero_nf: { $in: numeros } }, '-created_date', 200);
      } catch {
        // Ignora.
      }
    }

    const duplicidades: any[] = [];
    const add = (d: any) => duplicidades.push(d);

    for (const r of resultados) {
      // Pendentes — mesmo conteúdo (hash).
      if (r.hash) {
        for (const d of docs) {
          const mes = (d.arquivos_nf || []).find((an: any) => an && an.hash && an.hash === r.hash);
          if (mes || (d.arquivos_hash || []).includes(r.hash)) {
            add({
              arquivo_novo: r.arquivo, numero_nf: r.numero_nf, criterio: 'conteúdo idêntico',
              existente_documento_titulo: d.titulo || '', existente_arquivo: mes?.arquivo || '',
              existente_documento_id: d.id, existente_numero: d.numero || '', existente_status: d.status || ''
            });
          }
        }
      }
      // Pendentes — mesmo arquivo (URL).
      if (r.arquivo) {
        for (const d of docs) {
          if ((d.arquivos || []).includes(r.arquivo)) {
            add({
              arquivo_novo: r.arquivo, numero_nf: r.numero_nf, criterio: 'mesmo arquivo',
              existente_documento_titulo: d.titulo || '', existente_arquivo: r.arquivo,
              existente_documento_id: d.id, existente_numero: d.numero || '', existente_status: d.status || ''
            });
          }
        }
      }
      // Pendentes — mesmo nº de NF.
      if (r.numero_nf) {
        for (const d of docs) {
          for (const an of (d.arquivos_nf || [])) {
            if (an && an.numero_nf === r.numero_nf) {
              add({
                arquivo_novo: r.arquivo, numero_nf: r.numero_nf, criterio: 'mesmo nº de NF',
                existente_documento_titulo: d.titulo || '', existente_arquivo: an.arquivo || '',
                existente_documento_id: d.id, existente_numero: d.numero || '', existente_status: d.status || ''
              });
            }
          }
        }
      }
      // Assinados — mesmo nº de NF.
      if (r.numero_nf) {
        for (const rn of rel) {
          if (rn.numero_nf === r.numero_nf) {
            add({
              arquivo_novo: r.arquivo, numero_nf: r.numero_nf, criterio: 'mesmo nº de NF',
              existente_documento_titulo: rn.documento_titulo || '', existente_arquivo: rn.arquivo_url || '',
              existente_documento_id: rn.documento_id || '', existente_numero: '', existente_status: 'assinado'
            });
          }
        }
      }
    }

    // Remove repetições da própria lista (mesmo arquivo + critério + envelope existente).
    const seen = new Set<string>();
    const unicas = duplicidades.filter((d) => {
      const k = `${d.arquivo_novo}|${d.criterio}|${d.existente_documento_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return Response.json({ ok: true, resultados, duplicidades: unicas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}