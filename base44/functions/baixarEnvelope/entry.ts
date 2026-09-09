import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { bytesToBase64 } from '../../shared/pdfUtils.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documentoId } = body || {};
    if (!documentoId) return Response.json({ error: 'documentoId obrigatorio' }, { status: 400 });

    const sigs = await base44.asServiceRole.entities.Assinatura.filter({ documento_id: documentoId }, '-created_date', 200);
    const signatario = sigs.filter((s) => s.etapa !== 'master' && s.arquivo_url);
    if (!signatario.length) return Response.json({ error: 'Nenhum arquivo assinado encontrado' }, { status: 404 });

    const merged = await PDFDocument.create();
    for (const s of signatario) {
      try {
        const resp = await fetch(s.arquivo_url);
        if (!resp.ok) continue;
        const bytes = await resp.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } catch {
        // skip files that fail to load
      }
    }

    const mergedBytes = await merged.save();
    return Response.json({ pdf_base64: bytesToBase64(new Uint8Array(mergedBytes)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}