// Carimbo, carga e gravação de PDFs — compartilhado entre carimbarPdf,
// restaurarAssinaturaGestao, baixarEnvelope e reconstruirPdfsEnvelope.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// PDF protegido por senha não pode ser carimbado: o carimbo preserva os fluxos
// criptografados e descarta o dicionário de criptografia, gerando arquivo corrompido
// (o Acrobat exibe "Há um erro nesta página"). Bloqueia antes de carimbar.
export const carregarPdf = async (bytes) => {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    const msg = String(error?.message || error).toLowerCase();
    if (msg.includes('encrypt')) {
      throw new Error('PDF protegido por senha: não é possível gravar a assinatura. Peça ao remetente uma versão sem senha.');
    }
    throw error;
  }
};

// Salva com estrutura conservadora (xref tradicional, sem object streams) e restaura o
// marcador binário do cabeçalho, que o runtime corrompe (bytes 0x81 no lugar de E2 E3 CF D3).
export const salvarPdf = async (pdfDoc) => {
  const bytes = new Uint8Array(await pdfDoc.save({ useObjectStreams: false }));
  const eol = bytes.indexOf(10); // fim da linha "%PDF-1.x"
  if (eol !== -1 && bytes[eol + 1] === 0x25 && eol + 6 < bytes.length) {
    bytes.set([0xe2, 0xe3, 0xcf, 0xd3], eol + 2);
  }
  return bytes;
};

// Aplica um carimbo de assinatura (imagem + texto) na primeira página.
export const aplicarCarimbo = async (pdfDoc, carimbo) => {
  const { imagemUrl, posX, posY, nome, data, observacao, operacao, unidade, indent, autoPosition, lado } = carimbo || {};

  let finalPosX = Number(posX || 5);
  let finalPosY = Number(posY || 88);
  if (autoPosition) {
    // Posição fixa: lado direito, parte inferior da página
    finalPosX = 75;
    finalPosY = 92;
  }

  const ladoDireita = lado === "direita"; // diretoria: texto à esquerda da imagem

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];

  let img = null;
  if (imagemUrl) {
    const imgResp = await fetch(imagemUrl, { signal: AbortSignal.timeout(30000) });
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
};