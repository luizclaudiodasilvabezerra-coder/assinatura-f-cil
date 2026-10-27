import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { aplicarCarimbo, carregarPdf, salvarPdf } from '../../shared/carimboPdf.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documento_id } = body || {};
    if (!documento_id) return Response.json({ error: 'documento_id obrigatório' }, { status: 400 });

    // Buscar assinaturas do documento
    const assinaturas = await base44.entities.Assinatura.filter({ documento_id }, "-created_date", 100);
    const gestao = assinaturas.find(a => a.etapa !== "master" && a.arquivo_url);
    const master = assinaturas.find(a => a.etapa === "master");

    if (!gestao) return Response.json({ error: 'Assinatura da gestão não encontrada' }, { status: 404 });

    // Recriar PDF com apenas a assinatura da gestão
    const originalUrl = gestao.arquivo_original_url || gestao.arquivo_url;
    const pdfResp = await fetch(originalUrl, { signal: AbortSignal.timeout(30000) });
    if (!pdfResp.ok) return Response.json({ error: 'Falha ao baixar PDF original' }, { status: 502 });

    const pdfDoc = await carregarPdf(await pdfResp.arrayBuffer());
    await aplicarCarimbo(pdfDoc, {
      imagemUrl: gestao.imagem_url,
      posX: gestao.pos_x || 3, posY: gestao.pos_y || 90,
      nome: gestao.assinante_nome,
      data: gestao.data_assinatura ? new Date(gestao.data_assinatura).toLocaleString("pt-BR") : '',
      observacao: gestao.observacao, operacao: gestao.operacao, unidade: gestao.unidade_negocio,
      indent: gestao.indent || 0,
    });

    const stamped = await salvarPdf(pdfDoc);

    // Upload do PDF restaurado
    const fileName = originalUrl.split('/').pop() || 'documento.pdf';
    const stampedFile = new File([new Uint8Array(stamped)], `assinado_${fileName}`, { type: "application/pdf" });
    const up = await base44.integrations.Core.UploadPublicFile({ file: stampedFile });

    // Atualizar assinatura da gestão com arquivo limpo
    await base44.entities.Assinatura.update(gestao.id, { arquivo_url: up.file_url });

    // Deletar assinatura master (diretoria)
    if (master) await base44.entities.Assinatura.delete(master.id);

    // Resetar status do envelope
    await base44.entities.Documento.update(documento_id, { status: "pendente_diretoria", pasta: "pendente" });

    return Response.json({
      success: true,
      file_url: up.file_url,
      message: "Arquivo restaurado com assinatura da gestão. Envelope reaberto para assinatura da diretoria."
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}