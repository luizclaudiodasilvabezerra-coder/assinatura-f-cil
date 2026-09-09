import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { enviarOutlook } from '../../shared/outlookMail.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documentoId } = body || {};
    if (!documentoId) return Response.json({ error: 'documentoId obrigatório' }, { status: 400 });

    const doc = await base44.entities.Documento.get(documentoId);
    if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    if (!doc.destinatario_email) return Response.json({ ok: false, reason: 'sem email do destinatario' });

    const linhas = [
      `Envelope: ${doc.numero || '-'}`,
      `Título: ${doc.titulo}`,
      `Signatário (gestão): ${doc.signatario_nome || '-'}`,
      `Unidade de negócio: ${doc.unidade_negocio || '-'}`,
      `Operação: ${doc.operacao || '-'}`,
      doc.data_limite ? `Data limite: ${doc.data_limite}` : '',
      `Arquivos: ${(doc.arquivos || []).length}`,
    ].filter(Boolean).join('\n');

    const html = `<div style="font-family:sans-serif"><p>Você tem notas para assinar no <strong>Assinatura digital</strong>.</p><pre style="white-space:pre-wrap;font-family:sans-serif;background:#f5f5f5;padding:12px;border-radius:8px">${linhas}</pre><p>Acesse a plataforma para conferir o envelope.</p></div>`;

    let via = 'plataforma';
    try {
      await enviarOutlook(base44, { to: doc.destinatario_email, subject: 'Você tem notas para assinar no Assinatura digital', html });
      via = 'outlook';
    } catch (e) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: doc.destinatario_email,
        subject: 'Você tem notas para assinar no Assinatura digital',
        html,
        from_name: doc.signatario_nome || 'Assinatura Fácil Log',
      });
    }

    return Response.json({ ok: true, via });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}