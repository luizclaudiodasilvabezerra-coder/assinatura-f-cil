// Carimbo, carga e gravação de PDFs — compartilhado entre carimbarPdf,
// restaurarAssinaturaGestao, baixarEnvelope e reconstruirPdfsEnvelope.
import { PDFDocument, StandardFonts, rgb } from 'npm:@cantoo/pdf-lib@2.11.1';

export const ERRO_SENHA_PDF = 'senha_pdf';
export const ERRO_SENHA_PDF_INCORRETA = 'senha_pdf_incorreta';

const erroDeSenha = (codigo, mensagem) => {
  const e = new Error(mensagem);
  e.code = codigo;
  return e;
};

// PDF protegido por senha: aberto com a senha informada e reconstruído em um documento
// novo (sem criptografia), para que o carimbo possa ser gravado sem corromper o arquivo.
// Sem senha (ou com senha errada) sinaliza pelo `code`, e o frontend pede a senha.
export const carregarPdf = async (bytes, senha) => {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    const msg = String(error?.message || error).toLowerCase();
    if (!msg.includes('encrypt')) throw error;
    if (!senha) {
      throw erroDeSenha(ERRO_SENHA_PDF, 'PDF protegido por senha: informe a senha do arquivo para gravar a assinatura.');
    }
    let aberto;
    try {
      aberto = await PDFDocument.load(bytes, { password: String(senha) });
    } catch {
      throw erroDeSenha(ERRO_SENHA_PDF_INCORRETA, 'Senha incorreta para este PDF. Confira e tente novamente.');
    }
    const limpo = await PDFDocument.create();
    const paginas = await limpo.copyPages(aberto, aberto.getPageIndices());
    paginas.forEach((p) => limpo.addPage(p));
    return limpo;
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

  // Carimbo proporcional à página: PDFs digitalizados têm páginas até 10x maiores que A4,
  // e um tamanho fixo ficava ilegível. Referência: altura A4 = 842pt.
  // Bloco de ~18% da altura e texto de 14pt no A4: visível e legível em qualquer digitalização.
  const escala = pageH / 842;
  const imgH = 150 * escala;
  const imgW = img ? (img.width / img.height) * imgH : 170 * escala;
  const gap = 12 * escala;
  const x = (finalPosX / 100) * pageW;
  const yTop = (finalPosY / 100) * pageH;
  const yTopPdf = pageH - yTop; // topo do bloco (coord PDF)
  const imgY = yTopPdf - imgH; // base da imagem
  if (img) page.drawImage(img, { x, y: imgY, width: imgW, height: imgH });

  let fs = 14 * escala;
  const indentPx = (Number(indent || 0)) * 16 * escala;

  const l1 = [nome ? 'Assinado por: ' + nome : '', data ? 'Assinado em: ' + data : ''].filter(Boolean).join('   |   ');
  const l2 = [observacao ? 'Obs: ' + observacao : '', operacao ? 'Operação: ' + operacao : '', unidade ? 'Unidade: ' + unidade : ''].filter(Boolean).join('   |   ');

  const largura = (txt) => (txt ? font.widthOfTextAtSize(txt, fs) : 0);

  // Encolhe o texto apenas se ele não couber na largura disponível (nunca sai da página)
  const textLeft = ladoDireita ? gap : x + imgW + gap;
  const disponivel = ladoDireita ? x - gap - gap : pageW - textLeft - gap;
  const maior = Math.max(largura(l1), largura(l2));
  if (maior > disponivel && maior > 0 && disponivel > 0) fs = fs * (disponivel / maior);

  const lineH = fs * 1.25;
  const centerY = yTopPdf - imgH / 2;

  if (ladoDireita) {
    // Texto à ESQUERDA da imagem (diretoria): alinhado à direita, cresce para a esquerda
    const maxTextWidth = Math.max(largura(l1), largura(l2));
    const textStartX = x - gap - maxTextWidth;
    if (l1) page.drawText(l1, { x: textStartX + indentPx, y: centerY + lineH / 2 - fs * 0.15, size: fs, font, color: rgb(0, 0, 0) });
    if (l2) page.drawText(l2, { x: textStartX + indentPx, y: centerY - lineH / 2 - fs * 0.15, size: fs, font, color: rgb(0, 0, 0) });
  } else {
    // Texto à DIREITA da imagem (gestão): comportamento padrão
    const textX = x + imgW + gap;
    if (l1) page.drawText(l1, { x: textX + indentPx, y: centerY + lineH / 2 - fs * 0.15, size: fs, font, color: rgb(0, 0, 0) });
    if (l2) page.drawText(l2, { x: textX + indentPx, y: centerY - lineH / 2 - fs * 0.15, size: fs, font, color: rgb(0, 0, 0) });
  }
};