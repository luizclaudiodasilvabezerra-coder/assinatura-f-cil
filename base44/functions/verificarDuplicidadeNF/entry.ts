import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const norm = (a) => (typeof a === 'string' ? { url: a, hash: '' } : { url: a.url, hash: a.hash || '' });

// Verifica duplicidade de NF/boleto por três critérios, do mais ao menos confiável:
// 1) hash do conteúdo do arquivo (mesmo arquivo reenviado) — determinístico;
// 2) mesma URL de arquivo (reuso do mesmo upload);
// 3) mesmo número de NF (extraído via IA) — melhor esforço.
// Consulta envelopes pendentes (Documento) e assinados (RelatorioNF).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const arquivos = (Array.isArray(body?.arquivos) ? body.arquivos.filter(Boolean) : []).map(norm);
    if (arquivos.length === 0 || arquivos.length > 100) return Response.json({ error: 'Envie de 1 a 100 arquivos por envelope.' }, { status: 400 });
    const appFilesPrefix = 'https://base44.app/api/apps/6aa074a5ce060f1b2caeee8f/files/';
    if (arquivos.some((a) => typeof a.url !== 'string' || a.url.length > 2048 || !a.url.startsWith(appFilesPrefix) || (a.hash && !/^[a-f0-9]{64}$/i.test(a.hash)))) {
      return Response.json({ error: 'Arquivos inválidos para a verificação de duplicidade.' }, { status: 400 });
    }

    // Limita as chamadas simultâneas. Falhas na leitura não podem virar "sem duplicidade".
    const resultados = [];
    for (let i = 0; i < arquivos.length; i += 4) {
      const batch = await Promise.all(arquivos.slice(i, i + 4).map(async (a) => {
        const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Analise esta Nota Fiscal ou boleto e extraia o número principal da NF/boleto em numero_nf, preservando os zeros à esquerda, e o nome/razão social do emitente em emitente. Nunca concatene números de documentos diferentes. Se não localizar um campo, retorne uma string vazia. Retorne somente os campos solicitados.`,
          file_urls: [a.url],
          response_json_schema: {
            type: 'object',
            properties: { numero_nf: { type: 'string' }, emitente: { type: 'string' } },
            required: ['numero_nf', 'emitente']
          }
        });
        if (!extracted || typeof extracted !== 'object') throw new Error('A leitura dos arquivos não foi concluída. Tente novamente.');
        const numero_nf = String(extracted.numero_nf || '').replace(/\D/g, '');
        const emitente = String(extracted.emitente || '').trim().replace(/^null$/i, '');
        return { arquivo: a.url, hash: a.hash, numero_nf, emitente };
      }));
      resultados.push(...batch);
    }

    const numeros = resultados.map((r) => r.numero_nf).filter((n) => n && n.length >= 3);
    const hashes = resultados.map((r) => r.hash).filter(Boolean);
    const urls = resultados.map((r) => r.arquivo).filter(Boolean);

    // 2) Envelopes pendentes que compartilham hash, URL ou numero_nf com os novos arquivos.
    const docsMap = new Map();
    const buscar = async (query) => {
      let cursor;
      do {
        const page = await base44.entities.Documento.filter(query, { sort: '-created_date', limit: 100, cursor, fields: ['titulo', 'numero', 'status', 'arquivos', 'arquivos_nf', 'arquivos_hash', 'numeros_nf'] });
        for (const d of page.items) docsMap.set(d.id, d);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
    };
    const criterios = [];
    if (hashes.length) criterios.push({ arquivos_hash: { $in: hashes } });
    if (urls.length) criterios.push({ arquivos: { $in: urls } });
    if (numeros.length) criterios.push({ numeros_nf: { $in: numeros } });
    await buscar({ $or: criterios });

    // 3) Envelopes assinados (RelatorioNF) por numero_nf.
    const rel = [];
    if (numeros.length) {
      let cursor;
      do {
        const page = await base44.entities.RelatorioNF.filter({ numero_nf: { $in: numeros } }, { sort: '-created_date', limit: 100, cursor, fields: ['numero_nf', 'documento_id', 'documento_titulo', 'arquivo_url'] });
        rel.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
      const ids = [...new Set(rel.map((r) => r.documento_id).filter((id) => id && !docsMap.has(id)))];
      if (ids.length) await buscar({ id: { $in: ids } });
    }
    const docs = Array.from(docsMap.values());
    const duplicidades = [];
    const add = (d) => duplicidades.push(d);

    for (const r of resultados) {
      // Pendentes — mesmo conteúdo (hash).
      if (r.hash) {
        for (const d of docs) {
          const mes = (d.arquivos_nf || []).find((an) => an && an.hash && an.hash === r.hash);
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
              existente_documento_id: rn.documento_id || '', existente_numero: docsMap.get(rn.documento_id)?.numero || '', existente_status: 'assinado'
            });
          }
        }
      }
    }

    // Uma crítica por arquivo e envelope, mesmo quando mais de um critério coincide.
    const seen = new Set();
    const unicas = duplicidades.filter((d) => {
      const k = `${d.arquivo_novo}|${d.existente_documento_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return Response.json({ ok: true, resultados, duplicidades: unicas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}