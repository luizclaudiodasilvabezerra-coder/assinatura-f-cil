import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { aplicarCarimbo, carregarPdf, salvarPdf } from '../../shared/carimboPdf.ts';

// Regera os arquivos assinados de envelopes pendentes na diretoria a partir do arquivo
// original + carimbos registrados, aplicando o carimbo proporcional à página (legível).
// Uso administrativo (reparo). Nunca altera um arquivo cujo carimbo falhe.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Somente administradores podem reajustar carimbos.' }, { status: 403 });

    const body = await req.json().catch(() => ({})) || {};
    const alvo = typeof body.documento_id === 'string' && body.documento_id ? body.documento_id : null;
    if (alvo && !/^[a-f0-9]{24}$/i.test(alvo)) return Response.json({ error: 'documento_id inválido' }, { status: 400 });

    // Envelopes alvo: um específico ou todos os pendentes na diretoria
    const documentos = [];
    if (alvo) {
      const doc = await base44.entities.Documento.get(alvo).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!doc) return Response.json({ error: 'Envelope não encontrado' }, { status: 404 });
      documentos.push(doc);
    } else {
      let cursor;
      do {
        const page = await base44.entities.Documento.filter({ status: 'pendente_diretoria' }, { sort: '-created_date', limit: 100, cursor });
        documentos.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
    }

    const reajustadas = [];
    const ignoradas = [];
    const falhas = [];

    for (const doc of documentos) {
      // Assinaturas ativas do envelope (paginado)
      const sigs = [];
      let cursor;
      do {
        const page = await base44.entities.Assinatura.filter({ documento_id: doc.id, status: 'assinado' }, { sort: 'created_date', limit: 100, cursor });
        sigs.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);

      const tarefas = sigs.map((s) => async () => {
        const base = s.arquivo_original_url || '';
        if (!base || !s.imagem_url) {
          ignoradas.push({ documento: doc.numero, assinatura: s.id, motivo: 'sem arquivo base ou imagem' });
          return;
        }
        try {
          const resp = await fetch(base, { signal: AbortSignal.timeout(30000) });
          if (!resp.ok) throw new Error('falha ao baixar arquivo base');
          const pdfDoc = await carregarPdf(await resp.arrayBuffer());

          await aplicarCarimbo(pdfDoc, {
            imagemUrl: s.imagem_url,
            posX: s.pos_x, posY: s.pos_y,
            nome: s.assinante_nome,
            data: s.data_assinatura ? new Date(s.data_assinatura).toLocaleString('pt-BR') : '',
            observacao: s.observacao,
            operacao: s.operacao,
            unidade: s.unidade_negocio,
            indent: s.indent || 0,
            lado: s.etapa === 'master' ? 'direita' : undefined,
          });

          const bytes = await salvarPdf(pdfDoc);
          const nomeBase = String(base.split('/').pop() || 'documento.pdf').replace(/[^\w.\-]/g, '_').slice(-80);
          const up = await base44.asServiceRole.integrations.Core.UploadPublicFile({
            file: new File([bytes], 'legivel_' + nomeBase, { type: 'application/pdf' }),
          });
          if (!up?.file_url) throw new Error('falha no upload');

          await base44.entities.Assinatura.update(s.id, { arquivo_url: up.file_url });
          reajustadas.push({ documento: doc.numero || doc.id, assinatura: s.id, etapa: s.etapa, arquivo_url: up.file_url });
        } catch (error) {
          falhas.push({ documento: doc.numero || doc.id, assinatura: s.id, motivo: String(error?.message || error) });
        }
      });

      // 3 por vez: mantém o Worker longe do limite de conexões simultâneas
      for (let i = 0; i < tarefas.length; i += 3) {
        await Promise.allSettled(tarefas.slice(i, i + 3).map((t) => t()));
      }
    }

    return Response.json({
      ok: falhas.length === 0,
      envelopes: documentos.length,
      reajustadas: reajustadas.length,
      ignoradas,
      falhas,
      arquivos: reajustadas,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}