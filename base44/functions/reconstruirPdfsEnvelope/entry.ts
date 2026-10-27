import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { aplicarCarimbo, carregarPdf, salvarPdf } from '../../shared/carimboPdf.ts';

// Reconstrói os PDFs assinados de um envelope a partir de uma base legível + carimbos
// registrados, substituindo as URLs antigas nos arquivos/lotes do envelope e nas
// assinaturas informadas. Uso administrativo (reparo de arquivos corrompidos).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Somente administradores podem reconstruir PDFs.' }, { status: 403 });

    const body = await req.json().catch(() => ({})) || {};
    const { documento_id, arquivos } = body;
    if (typeof documento_id !== 'string' || !documento_id) return Response.json({ error: 'documento_id obrigatório' }, { status: 400 });
    if (!Array.isArray(arquivos) || arquivos.length === 0 || arquivos.length > 10) return Response.json({ error: 'Envie de 1 a 10 arquivos.' }, { status: 400 });

    const appFilesPrefix = 'https://base44.app/api/apps/6aa074a5ce060f1b2caeee8f/files/';
    const validarUrl = (u) => typeof u === 'string' && u.startsWith(appFilesPrefix) && u.length < 2048;

    const doc = await base44.entities.Documento.get(documento_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!doc) return Response.json({ error: 'Envelope não encontrado' }, { status: 404 });

    const mapaUrls = {}; // url antiga -> nova
    const resultado = [];

    for (const arq of arquivos) {
      const { base_url, nome, substituir, assinatura_ids, stamps } = arq || {};
      if (!validarUrl(base_url)) return Response.json({ error: 'base_url inválida.' }, { status: 400 });
      if (!Array.isArray(stamps) || stamps.length === 0 || stamps.length > 10) return Response.json({ error: 'Envie de 1 a 10 carimbos por arquivo.' }, { status: 400 });

      const resp = await fetch(base_url, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) return Response.json({ error: 'Falha ao baixar a base: ' + String(nome || base_url) }, { status: 502 });

      const pdfDoc = await carregarPdf(await resp.arrayBuffer());
      for (const stamp of stamps || []) {
        await aplicarCarimbo(pdfDoc, {
          imagemUrl: validarUrl(stamp.imagem_url) ? stamp.imagem_url : '',
          posX: stamp.pos_x, posY: stamp.pos_y,
          nome: String(stamp.nome || '').slice(0, 100),
          data: String(stamp.data || '').slice(0, 40),
          observacao: String(stamp.observacao || '').slice(0, 200),
          operacao: String(stamp.operacao || '').slice(0, 100),
          unidade: String(stamp.unidade || '').slice(0, 100),
          indent: Number(stamp.indent || 0),
          lado: stamp.lado === 'direita' ? 'direita' : undefined,
          autoPosition: !!stamp.auto_position,
        });
      }

      const bytes = await salvarPdf(pdfDoc);
      const nomeArquivo = 'reconstruido_' + String(nome || 'documento.pdf').replace(/[^\w.\-]/g, '_').slice(0, 90);
      const up = await base44.asServiceRole.integrations.Core.UploadPublicFile({
        file: new File([bytes], nomeArquivo, { type: 'application/pdf' }),
      });
      if (!up?.file_url) return Response.json({ error: 'Falha no upload do arquivo reconstruído.' }, { status: 500 });

      for (const u of (Array.isArray(substituir) ? substituir : [])) {
        if (validarUrl(u)) mapaUrls[u] = up.file_url;
      }
      if (Array.isArray(assinatura_ids) && assinatura_ids.length) {
        await Promise.allSettled(assinatura_ids.slice(0, 20).map((id) =>
          base44.entities.Assinatura.update(String(id), { arquivo_url: up.file_url })
        ));
      }
      resultado.push({ nome: nomeArquivo, url: up.file_url });
    }

    // Substitui as URLs antigas nos arquivos e lotes do envelope
    const trocar = (u) => mapaUrls[u] || u;
    await base44.entities.Documento.update(documento_id, {
      arquivos: (doc.arquivos || []).map(trocar),
      lotes: (doc.lotes || []).map((l) => ({ ...(l || {}), arquivos: ((l || {}).arquivos || []).map(trocar) })),
    });

    return Response.json({ ok: true, arquivos: resultado, substituidas: Object.keys(mapaUrls).length });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}