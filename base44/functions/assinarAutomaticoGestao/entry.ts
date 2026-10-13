import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { signatarioRedirecionado, normNome } from '../../shared/redirecionamento.ts';

// Hierarquia de assinatura: signatários-fonte (Anderson/Ana/Matheus) têm todas as páginas
// carimbadas automaticamente com a PRÓPRIA assinatura cadastrada. O envelope é então
// reatribuído ao destino (Joselio Serur) e MANTIDO em pendente_gestao, aguardando a
// assinatura manual de Joselio. Após a assinatura manual (fluxo normal do AssinarDocumento),
// o envelope avança para a diretoria.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { documentoId } = body || {};
    if (!documentoId) return Response.json({ error: 'documentoId obrigatório' }, { status: 400 });

    const doc = await base44.asServiceRole.entities.Documento.get(documentoId);
    if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    if (doc.status !== 'pendente_gestao') return Response.json({ ok: false, reason: 'already_processed' });

    // Apenas signatários-fonte disparam o auto-carimbo (ex.: Matheus Santos).
    // O destino (Joselio Serur) assina manualmente após o redirecionamento.
    const destinoNome = signatarioRedirecionado(doc.signatario_nome);
    if (!destinoNome) return Response.json({ ok: false, reason: 'not_applicable' });

    const cadastros = await base44.asServiceRole.entities.Cadastro.filter(
      { tipo: { $in: ["signatario", "destinatario", "ambos"] } },
      { limit: 200 }
    );
    // Responsável = o próprio signatário-fonte (ex.: Matheus Santos). É a assinatura DELE que será carimbada.
    const responsavel = cadastros.items.find((c) => normNome(c.nome) === normNome(doc.signatario_nome));
    if (!responsavel || !responsavel.imagem_assinatura) {
      return Response.json({ ok: false, reason: 'no_signature' }, { status: 400 });
    }
    // Cadastro do destino (Joselio Serur) para reatribuir o signatário do envelope
    const destinoCadastro = cadastros.items.find((c) => normNome(c.nome) === normNome(destinoNome));

    const imagemUrl = responsavel.imagem_assinatura;
    const arquivos = doc.arquivos || [];
    if (!arquivos.length) return Response.json({ ok: false, reason: 'no_files' }, { status: 400 });

    const dataStr = new Date().toLocaleString("pt-BR");
    const posX = 3, posY = 90;
    const operacao = doc.operacao || "";
    const unidade = doc.unidade_negocio || "";

    let stamped = 0, falhou = 0;
    const erros = [];
    const novosArquivos = [];
    const urlMap = {}; // original -> carimbado (para atualizar lotes)
    for (const fileUrl of arquivos) {
      let novoUrl = fileUrl;
      if (/\.pdf$/i.test(fileUrl)) {
        try {
          const pdfResp = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
          if (!pdfResp.ok) { falhou++; erros.push({ arquivo: fileUrl.slice(-40), erro: 'fetch_failed' }); novosArquivos.push(fileUrl); continue; }
          const pdfBytes = await pdfResp.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

          let img = null;
          const imgResp = await fetch(imagemUrl, { signal: AbortSignal.timeout(15000) });
          if (imgResp.ok) {
            const imgBytes = await imgResp.arrayBuffer();
            const isPng = /\.png$/i.test(imagemUrl);
            try { img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes); } catch { img = null; }
          }

          const pages = pdfDoc.getPages();
          for (const page of pages) {
            const pageW = page.getWidth();
            const pageH = page.getHeight();
            const imgH = 60;
            const imgW = img ? (img.width / img.height) * imgH : 68;
            const x = (posX / 100) * pageW;
            const yTop = (posY / 100) * pageH;
            const yTopPdf = pageH - yTop;
            const imgY = yTopPdf - imgH;
            if (img) page.drawImage(img, { x, y: imgY, width: imgW, height: imgH });

            const fs = 8;
            const lineH = fs + 2;
            const l1 = `Assinado por: ${responsavel.nome}   |   Assinado em: ${dataStr}`;
            const l2 = [operacao ? 'Operação: ' + operacao : '', unidade ? 'Unidade: ' + unidade : ''].filter(Boolean).join('   |   ');
            const textX = x + imgW + 8;
            const centerY = yTopPdf - imgH / 2;
            page.drawText(l1, { x: textX, y: centerY + lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
            if (l2) page.drawText(l2, { x: textX, y: centerY - lineH / 2 - 1, size: fs, font, color: rgb(0, 0, 0) });
          }

          const stampedBytes = await pdfDoc.save();
          const pdfFile = new File([stampedBytes], "assinado.pdf", { type: "application/pdf" });
          const up = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file: pdfFile });
          novoUrl = up.file_url;
          stamped++;
        } catch (e) { falhou++; erros.push({ arquivo: fileUrl.slice(-40), erro: e.message }); novosArquivos.push(fileUrl); continue; }
      } else {
        stamped++;
      }

      novosArquivos.push(novoUrl);
      if (novoUrl !== fileUrl) urlMap[fileUrl] = novoUrl;

      try {
        await base44.asServiceRole.entities.Assinatura.create({
          documento_id: documentoId,
          documento_titulo: doc.titulo,
          arquivo_url: novoUrl,
          arquivo_original_url: fileUrl,
          assinante_nome: responsavel.nome,
          assinante_email: responsavel.email || "",
          assinante_cadastro_id: responsavel.id,
          imagem_url: imagemUrl,
          tipo: "uploadada",
          etapa: "gestao_origem",
          observacao: "Assinatura automática da gestão de origem (redirecionamento)",
          indent: 0,
          pos_x: posX,
          pos_y: posY,
          unidade_negocio: unidade,
          operacao: operacao,
          status: "assinado",
          data_assinatura: new Date().toISOString(),
        });
      } catch { falhou++; }
    }

    // Atualiza lotes para refletir as novas URLs carimbadas (preserva agrupamento)
    const novosLotes = (doc.lotes || []).map((lote) => ({
      ...lote,
      arquivos: (lote.arquivos || []).map((url) => urlMap[url] || url),
    }));

    // Reatribui o signatário ao destino (Joselio Serur) e MANTÉM status pendente_gestao,
    // aguardando a assinatura manual. Substitui doc.arquivos pelas versões carimbadas.
    await base44.asServiceRole.entities.Documento.update(documentoId, {
      arquivos: novosArquivos,
      lotes: novosLotes,
      signatario_nome: destinoCadastro ? destinoCadastro.nome : destinoNome,
      signatario_email: destinoCadastro?.email || "",
      signatario_cadastro_id: destinoCadastro?.id || "",
      status: "pendente_gestao",
    });

    return Response.json({ ok: true, stamped, falhou, total: arquivos.length, erros, redirecionadoPara: destinoNome });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}