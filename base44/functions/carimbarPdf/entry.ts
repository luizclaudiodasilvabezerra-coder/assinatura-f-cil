import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';
import { getDocument, GlobalWorkerOptions } from 'npm:pdfjs-dist@3.11.174/legacy/build/pdf.js';

GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.js';

function normalize(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// Localiza o campo por visão (LLM) quando o PDF não tem texto extraível.
async function findFieldByVision(base44, fileUrl) {
  try {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: "Analise a primeira pagina deste PDF de nota fiscal. Localize o QUADRO INTEIRO de 'INFORMACOES COMPLEMENTARES' (incluindo o rotulo e toda a area em branco reservada para preenchimento abaixo do rotulo). Se nao existir, use o quadro 'AREA RESERVADA AO FISCO' / 'USO EXCLUSIVO DO FISCO'. Retorne as coordenadas do QUADRO COMPLETO (do topo do rotulo ate a linha inferior da caixa) como porcentagem da pagina, origem no canto superior esquerdo: x (esquerda %), y (topo %), largura (%) e altura (%). Responda apenas com o JSON.",
      file_urls: [fileUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          encontrado: { type: 'boolean' },
          campo: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          largura: { type: 'number' },
          altura: { type: 'number' }
        },
        required: ['encontrado']
      }
    });
    if (res && res.encontrado && res.x != null && res.y != null) {
      return { vision: true, campo: res.campo, xPct: res.x, yPct: res.y, wPct: res.largura, hPct: res.altura };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Localiza o campo "Informações Complementares" ou "Área reservada ao fisco"
// no PDF, retornando a posição (em coordenadas PDF, origem inferior-esquerda).
async function findFieldPosition(pdfBytes) {
  try {
    const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false, useWorkerFetch: false });
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    let best = null;
    for (const item of content.items) {
      const str = normalize(item.str);
      if (!str) continue;
      if (str.includes('COMPLEMENTAR')) {
        const t = item.transform;
        best = { x: t[4], y: t[5], h: Math.abs(t[3]) || 10, kind: 'complementar' };
        break;
      }
    }
    if (!best) {
      for (const item of content.items) {
        const str = normalize(item.str);
        if (!str) continue;
        if (str.includes('FISCO')) {
          const t = item.transform;
          best = { x: t[4], y: t[5], h: Math.abs(t[3]) || 10, kind: 'fisco' };
          break;
        }
      }
    }
    const sample = content.items.map(i => normalize(i.str)).filter(Boolean);
    await doc.destroy();
    return { field: best, text: sample };
  } catch (e) {
    console.log('FIELDFIND_ERR:', e.message);
    return null;
  }
}

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

    // Tenta localizar o campo Informações Complementares / Área reservada ao fisco
    const fieldResult = await findFieldPosition(pdfBytes.slice(0));
    let field = fieldResult && fieldResult.field ? fieldResult.field : null;
    let visionField = null;
    if (!field) {
      visionField = await findFieldByVision(base44, fileUrl);
      if (visionField) field = visionField;
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
    const imgW = 160;
    const imgH = img ? (img.height / img.width) * imgW : 56;
    const fontSize = 9;
    const indentPx = (Number(indent || 0)) * 14;

    if (field && field.vision) {
      // Campo localizado por visão: layout compacto dentro do quadro (assinatura + 2 linhas)
      const boxLeft = (field.xPct / 100) * pageW;
      const boxTopPdf = pageH - (field.yPct / 100) * pageH;
      const boxBottomPdf = pageH - ((field.yPct + field.hPct) / 100) * pageH;
      const boxHeight = Math.max(16, boxTopPdf - boxBottomPdf);
      const imgH2 = img ? Math.min(60, Math.max(18, boxHeight - 6)) : 0;
      const imgW2 = img ? (img.width / img.height) * imgH2 : 0;
      const imgX = boxLeft + 6;
      const imgY = boxBottomPdf + (boxHeight - imgH2) / 2;
      if (img) page.drawImage(img, { x: imgX, y: imgY, width: imgW2, height: imgH2 });
      const fs = Math.min(9, Math.max(6.5, boxHeight * 0.26));
      const lineH = fs + 2;
      const textX = imgX + imgW2 + 10;
      const centerPdf = boxBottomPdf + boxHeight / 2;
      const l1 = [nome ? 'Assinado por: ' + nome : '', data ? 'Assinado em: ' + data : ''].filter(Boolean).join('   |   ');
      const l2 = [observacao ? 'Observação: ' + observacao : '', operacao ? 'Operação: ' + operacao : '', unidade ? 'Unidade: ' + unidade : ''].filter(Boolean).join('   |   ');
      if (l1) page.drawText(l1, { x: textX, y: centerPdf + lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
      if (l2) page.drawText(l2, { x: textX, y: centerPdf - lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
    } else {
      let x, textY;
      if (field) {
        // Texto extraído: fixa o carimbo dentro do campo, logo abaixo do rótulo
        x = field.x + 6;
        const imgTop = field.y - 6;
        const imgY = imgTop - imgH;
        if (img) page.drawImage(img, { x, y: imgY, width: imgW, height: imgH });
        textY = imgY - 12;
      } else {
        // Fallback: posição arrastada (porcentagem da página)
        x = (Number(posX || 10) / 100) * pageW;
        const yTop = (Number(posY || 70) / 100) * pageH;
        const y = pageH - yTop;
        if (img) page.drawImage(img, { x, y: y - imgH, width: imgW, height: imgH });
        textY = y - imgH - 12;
      }
      const lines = [];
      if (nome) lines.push('Assinado por: ' + nome);
      if (data) lines.push('Assinado em: ' + data);
      if (observacao) lines.push('Observação: ' + observacao);
      if (operacao) lines.push('Operação: ' + operacao);
      if (unidade) lines.push('Unidade de negócio: ' + unidade);
      for (const line of lines) {
        page.drawText(line, { x: x + indentPx, y: textY, size: fontSize, font, color: rgb(0, 0, 0) });
        textY -= fontSize + 3;
      }
    }

    const stamped = await pdfDoc.save();
    if (body.debug) {
      return Response.json({ field: field ? (field.kind || field.campo || 'vision') : null, fieldPos: field, vision: visionField, pageW: page.getWidth(), pageH: page.getHeight(), text: fieldResult ? fieldResult.text : [] });
    }
    return Response.json({ pdf_base64: bytesToBase64(new Uint8Array(stamped)), field: field ? field.kind : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}