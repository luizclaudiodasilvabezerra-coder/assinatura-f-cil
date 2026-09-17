import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

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
    const pdfResp = await fetch(originalUrl);
    if (!pdfResp.ok) return Response.json({ error: 'Falha ao baixar PDF original' }, { status: 502 });
    const pdfBytes = await pdfResp.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];

    let img = null;
    if (gestao.imagem_url) {
      const imgResp = await fetch(gestao.imagem_url);
      if (imgResp.ok) {
        const imgBytes = await imgResp.arrayBuffer();
        try {
          const isPng = /\.png$/i.test(gestao.imagem_url);
          img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
        } catch { img = null; }
      }
    }

    const pageW = page.getWidth();
    const pageH = page.getHeight();
    const imgH = 60;
    const imgW = img ? (img.width / img.height) * imgH : 68;
    const x = ((gestao.pos_x || 3) / 100) * pageW;
    const yTop = ((gestao.pos_y || 90) / 100) * pageH;
    const yTopPdf = pageH - yTop;
    const imgY = yTopPdf - imgH;
    if (img) page.drawImage(img, { x, y: imgY, width: imgW, height: imgH });

    const fs = 8;
    const lineH = fs + 2;
    const textX = x + imgW + 8;
    const centerY = yTopPdf - imgH / 2;
    const indentPx = (gestao.indent || 0) * 12;

    const l1 = [gestao.assinante_nome ? 'Assinado por: ' + gestao.assinante_nome : '', gestao.data_assinatura ? 'Assinado em: ' + new Date(gestao.data_assinatura).toLocaleString("pt-BR") : ''].filter(Boolean).join('   |   ');
    const l2 = [gestao.observacao ? 'Obs: ' + gestao.observacao : '', gestao.operacao ? 'Operação: ' + gestao.operacao : '', gestao.unidade_negocio ? 'Unidade: ' + gestao.unidade_negocio : ''].filter(Boolean).join('   |   ');

    if (l1) page.drawText(l1, { x: textX + indentPx, y: centerY + lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
    if (l2) page.drawText(l2, { x: textX + indentPx, y: centerY - lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });

    const stamped = await pdfDoc.save();

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