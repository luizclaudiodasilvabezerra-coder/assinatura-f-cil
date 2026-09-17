import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';

async function findBlankArea(pdfBuf) {
  try {
    const pdfjs = await import('npm:pdfjs-dist@3.11.174');
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = '';
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuf) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const pageW = viewport.width;
    const pageH = viewport.height;

    const bandH = 6;
    const numBands = Math.ceil(pageH / bandH);
    const occupied = new Array(numBands).fill(false);

    // 1. Marca bandas com texto (com altura e largura para melhor cobertura)
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (!item.transform) continue;
      const y = item.transform[5];
      const h = item.height || 10;
      const startBand = Math.floor((y - 2) / bandH);
      const endBand = Math.ceil((y + h + 2) / bandH);
      for (let b = Math.max(0, startBand); b <= Math.min(numBands - 1, endBand); b++) {
        occupied[b] = true;
      }
    }

    // 2. Marca bandas com imagens (assinaturas já carimbadas, logos, etc.)
    try {
      const OPS = pdfjs.OPS;
      if (OPS) {
        const opList = await page.getOperatorList();
        let ctm = [1, 0, 0, 1, 0, 0];
        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i];
          if (fn === OPS.transform) {
            ctm = args;
          } else if (
            fn === OPS.paintImageXObject ||
            fn === OPS.paintImageMaskXObject ||
            fn === OPS.paintInlineImage ||
            fn === OPS.paintImageXObjectRepeat
          ) {
            const y = ctm[5] || 0;
            const w = Math.abs(ctm[0] || 0);
            const h = Math.abs(ctm[3] || 0);
            if (w > 20 && h > 20) {
              const startBand = Math.floor((y - 2) / bandH);
              const endBand = Math.ceil((y + h + 2) / bandH);
              for (let b = Math.max(0, startBand); b <= Math.min(numBands - 1, endBand); b++) {
                occupied[b] = true;
              }
            }
          }
        }
      }
    } catch {}

    // 3. Procura maior banda em branco nos 60% inferiores da página
    const minLen = 12;
    const maxBand = Math.floor(numBands * 0.60);
    let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
    for (let i = 0; i <= maxBand; i++) {
      if (!occupied[i]) {
        if (curStart === -1) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      } else {
        curStart = -1; curLen = 0;
      }
    }

    // Se não encontrou nos 60% inferiores, busca na página toda
    if (bestStart === -1 || bestLen < minLen) {
      bestStart = -1; bestLen = 0; curStart = -1; curLen = 0;
      for (let i = 0; i < numBands; i++) {
        if (!occupied[i]) {
          if (curStart === -1) curStart = i;
          curLen++;
          if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
        } else {
          curStart = -1; curLen = 0;
        }
      }
    }

    if (bestStart === -1 || bestLen < minLen) return null;
    const centerY = (bestStart + bestLen / 2) * bandH;
    const posYPercent = (1 - centerY / pageH) * 100;
    return { x: 5, y: posYPercent };
  } catch {
    return null;
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fileUrl, imagemUrl, posX, posY, nome, data, observacao, operacao, unidade, indent, autoPosition } = body || {};
    if (!fileUrl) return Response.json({ error: 'fileUrl obrigatório' }, { status: 400 });

    const pdfResp = await fetch(fileUrl);
    if (!pdfResp.ok) return Response.json({ error: 'Falha ao baixar PDF' }, { status: 502 });
    const pdfBytes = await pdfResp.arrayBuffer();

    let finalPosX = Number(posX || 5);
    let finalPosY = Number(posY || 88);
    if (autoPosition) {
      const blank = await findBlankArea(pdfBytes.slice(0));
      if (blank) { finalPosX = blank.x; finalPosY = blank.y; }
    }

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

    // Bloco compacto: assinatura à esquerda + 2 linhas de texto à direita.
    // Ancorado no topo-esquerda em (posX%, posY%) da pagina para casar com o preview.
    const imgH = 60;
    const imgW = img ? (img.width / img.height) * imgH : 68;
    const x = (finalPosX / 100) * pageW;
    const yTop = (finalPosY / 100) * pageH;
    const yTopPdf = pageH - yTop; // topo do bloco (coord PDF)
    const imgY = yTopPdf - imgH; // base da imagem
    if (img) page.drawImage(img, { x, y: imgY, width: imgW, height: imgH });

    const fs = 8;
    const lineH = fs + 2;
    const textX = x + imgW + 8;
    const centerY = yTopPdf - imgH / 2;
    const indentPx = (Number(indent || 0)) * 12;

    const l1 = [nome ? 'Assinado por: ' + nome : '', data ? 'Assinado em: ' + data : ''].filter(Boolean).join('   |   ');
    const l2 = [observacao ? 'Obs: ' + observacao : '', operacao ? 'Operação: ' + operacao : '', unidade ? 'Unidade: ' + unidade : ''].filter(Boolean).join('   |   ');

    if (l1) page.drawText(l1, { x: textX + indentPx, y: centerY + lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
    if (l2) page.drawText(l2, { x: textX + indentPx, y: centerY - lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });

    const stamped = await pdfDoc.save();
    return Response.json({ pdf_base64: bytesToBase64(new Uint8Array(stamped)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}