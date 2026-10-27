import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';
import { carregarPdf, salvarPdf } from '../../shared/carimboPdf.ts';
import { assinaturaDaPagina, buscarAssinaturasAtivas, etapaGestao } from '../../shared/fluxoEnvelope.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documentoId } = body || {};
    if (!documentoId) return Response.json({ error: 'documentoId obrigatorio' }, { status: 400 });

    const envelope = await base44.entities.Documento.get(documentoId);
    const sigs = await buscarAssinaturasAtivas(base44, envelope);
    const signatario = (envelope.arquivos || []).map((url) => assinaturaDaPagina(sigs, url, 'master') || assinaturaDaPagina(sigs, url, etapaGestao(envelope)) || { arquivo_url: url });
    if (!signatario.length) return Response.json({ error: 'Nenhum arquivo ativo encontrado' }, { status: 404 });

    const merged = await (await import('npm:pdf-lib@1.17.1')).PDFDocument.create();
    const ignorados = [];
    for (const s of signatario) {
      try {
        const resp = await fetch(s.arquivo_url, { signal: AbortSignal.timeout(30000) });
        if (!resp.ok) { ignorados.push(s.arquivo_url); continue; }
        const bytes = await resp.arrayBuffer();
        const doc = await carregarPdf(bytes); // rejeita PDF protegido por senha (sairia corrompido no envelope)
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } catch {
        // arquivos que falham ao carregar entram na lista de ignorados
        ignorados.push(s.arquivo_url);
      }
    }

    const mergedBytes = await salvarPdf(merged);
    return Response.json({ pdf_base64: bytesToBase64(mergedBytes), ignorados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}