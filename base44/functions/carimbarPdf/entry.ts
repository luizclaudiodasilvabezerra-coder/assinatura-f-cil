import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fileUrl, imagemUrl, posX, posY, nome, data, observacao, operacao, unidade, indent, autoPosition, lado } = body || {};
    if (!fileUrl) return Response.json({ error: 'fileUrl obrigatório' }, { status: 400 });

    const pdfResp = await fetch(fileUrl);
    if (!pdfResp.ok) return Response.json({ error: 'Falha ao baixar PDF' }, { status: 502 });
    const pdfBytes = await pdfResp.arrayBuffer();

    let finalPosX = Number(posX || 5);
    let finalPosY = Number(posY || 88);
    if (autoPosition) {
      // Posição fixa: lado direito, parte inferior da página
      finalPosX = 75;
      finalPosY = 92;
    }

    const ladoDireita = lado === "direita"; // diretoria: texto à esquerda da imagem

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];

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

    const imgH = 60;
    const imgW = img ? (img.width / img.height) * imgH : 68;
    const x = (finalPosX / 100) * pageW;
    const yTop = (finalPosY / 100) * pageH;
    const yTopPdf = pageH - yTop; // topo do bloco (coord PDF)
    const imgY = yTopPdf - imgH; // base da imagem
    if (img) page.drawImage(img, { x, y: imgY, width: imgW, height: imgH });

    const fs = 8;
    const lineH = fs + 2;
    const indentPx = (Number(indent || 0)) * 12;

    const l1 = [nome ? 'Assinado por: ' + nome : '', data ? 'Assinado em: ' + data : ''].filter(Boolean).join('   |   ');
    const l2 = [observacao ? 'Obs: ' + observacao : '', operacao ? 'Operação: ' + operacao : '', unidade ? 'Unidade: ' + unidade : ''].filter(Boolean).join('   |   ');

    const centerY = yTopPdf - imgH / 2;

    if (ladoDireita) {
      // Texto à ESQUERDA da imagem (diretoria): alinhado à direita, cresce para a esquerda
      const l1Width = l1 ? font.widthOfTextAtSize(l1, fs) : 0;
      const l2Width = l2 ? font.widthOfTextAtSize(l2, fs) : 0;
      const maxTextWidth = Math.max(l1Width, l2Width);
      const textRightEdge = x - 8; // borda direita do texto = borda esquerda da imagem - 8
      const textStartX = textRightEdge - maxTextWidth;
      if (l1) page.drawText(l1, { x: textStartX + indentPx, y: centerY + lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
      if (l2) page.drawText(l2, { x: textStartX + indentPx, y: centerY - lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
    } else {
      // Texto à DIREITA da imagem (gestão): comportamento padrão
      const textX = x + imgW + 8;
      if (l1) page.drawText(l1, { x: textX + indentPx, y: centerY + lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
      if (l2) page.drawText(l2, { x: textX + indentPx, y: centerY - lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
    }

    const stamped = await pdfDoc.save();
    return Response.json({ pdf_base64: bytesToBase64(new Uint8Array(stamped)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}