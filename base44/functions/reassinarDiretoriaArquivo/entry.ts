import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assinatura_id, fileUrl, imagemUrl, nome, observacao, indent, unidade, operacao, data } = body;

    if (!assinatura_id || !fileUrl || !imagemUrl) {
      return Response.json({ error: 'assinatura_id, fileUrl e imagemUrl são obrigatórios' }, { status: 400 });
    }

    // 1. Carimba o PDF com a assinatura na posição fixa (direita inferior)
    const carimboResp = await base44.functions.invoke('carimbarPdf', {
      fileUrl,
      imagemUrl,
      nome: nome || 'Diretoria',
      observacao: observacao || '',
      indent: indent || 0,
      unidade: unidade || '',
      operacao: operacao || '',
      data: data || '',
      autoPosition: true,
      lado: "direita"
    });

    const pdfBase64 = carimboResp.data?.pdf_base64;
    if (!pdfBase64) return Response.json({ error: 'Falha ao carimbar PDF' }, { status: 500 });

    // 2. Converte base64 para Blob e faz upload
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const file = new File([blob], 'assinado_diretoria.pdf', { type: 'application/pdf' });

    const uploadResp = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
    const newFileUrl = uploadResp.file_url;
    if (!newFileUrl) return Response.json({ error: 'Falha no upload do PDF' }, { status: 500 });

    // 3. Atualiza o registro de assinatura com o novo arquivo e posição
    await base44.entities.Assinatura.update(assinatura_id, {
      arquivo_url: newFileUrl,
      pos_x: 75,
      pos_y: 92
    });

    return Response.json({ success: true, arquivo_url: newFileUrl, pos_x: 75, pos_y: 92 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}