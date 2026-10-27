import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';
import { aplicarCarimbo, carregarPdf, salvarPdf } from '../../shared/carimboPdf.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fileUrl, imagemUrl, posX, posY, nome, data, observacao, operacao, unidade, indent, autoPosition, lado } = body || {};
    if (!fileUrl) return Response.json({ error: 'fileUrl obrigatório' }, { status: 400 });

    const pdfResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
    if (!pdfResp.ok) return Response.json({ error: 'Falha ao baixar PDF' }, { status: 502 });
    const pdfBytes = await pdfResp.arrayBuffer();

    const pdfDoc = await carregarPdf(pdfBytes);
    await aplicarCarimbo(pdfDoc, { imagemUrl, posX, posY, nome, data, observacao, operacao, unidade, indent, autoPosition, lado });

    const stamped = await salvarPdf(pdfDoc);
    return Response.json({ pdf_base64: bytesToBase64(stamped) });
  } catch (error) {
    const msg = String(error?.message || error);
    // PDF protegido por senha: condição conhecida e acionável — retorna 200 com a mensagem
    // específica, que o frontend já exibe (resposta sem pdf_base64).
    if (msg.includes('protegido por senha')) return Response.json({ error: msg });
    return Response.json({ error: msg }, { status: 500 });
  }
}