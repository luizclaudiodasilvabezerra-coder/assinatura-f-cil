import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fileUrl, imagemUrl, posX, posY, nome, data, observacao, operacao, unidade, indent } = body || {};
    if (!fileUrl) return Response.json({ error: 'fileUrl obrigatório' }, { status: 400 });

    const pdfResp = await fetch(fileUrl);
    if (!pdfResp.ok) return Response.json({ error: 'Falha ao baixar PDF' }, { status: 502 });
    const pdfBytes = await pdfResp.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const page = pages[0];

    let img = null;
    if (imagemUrl) {
      const imgResp = await fetch(imagemUrl);
      if (imgResp.ok) {
        const imgBytes = await imgResp.arrayBuffer();
        const isPng = /\.png$/i.test(imagemUrl);
        try {
          img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
        } catch {
          img = null;
        }
      }
    }

    const pageW = page.getWidth();
    const pageH = page.getHeight();
    const x = (Number(posX || 10) / 100) * pageW;
    const yTop = (Number(posY || 70) / 100) * pageH;
    const y = pageH - yTop;

    const imgW = 180;
    const imgH = img ? (img.height / img.width) * imgW : 60;
    if (img) page.drawImage(img, { x, y: y - imgH, width: imgW, height: imgH });

    const fontSize = 9;
    let textY = y - imgH - 12;
    const indentPx = (Number(indent || 0)) * 14;
    const lines = [];
    if (nome) lines.push('Assinado por: ' + nome);
    if (data) lines.push('Criada em: ' + data);
    if (observacao) lines.push('Observação: ' + observacao);
    if (operacao) lines.push('Operação: ' + operacao);
    if (unidade) lines.push('Unidade de negócio: ' + unidade);
    for (const line of lines) {
      page.drawText(line, { x: x + indentPx, y: textY, size: fontSize, font, color: rgb(0, 0, 0) });
      textY -= fontSize + 3;
    }

    const stamped = await pdfDoc.save();
    return Response.json({ pdf_base64: bytesToBase64(new Uint8Array(stamped)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}