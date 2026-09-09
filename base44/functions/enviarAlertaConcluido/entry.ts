import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { enviarOutlook } from '../../shared/outlookMail.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { documentoId, diretoriaNome } = body || {};
    if (!documentoId) return Response.json({ error: 'documentoId obrigatório' }, { status: 400 });

    const doc = await base44.entities.Documento.get(documentoId);
    if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });

    const [dests, ambos] = await Promise.all([
      base44.entities.Cadastro.filter({ tipo: 'destinatario' }),
      base44.entities.Cadastro.filter({ tipo: 'ambos' }),
    ]);
    const emails = Array.from(new Set([...dests, ...ambos].map((c) => c.email).filter(Boolean)));
    if (emails.length === 0) return Response.json({ ok: false, reason: 'sem destinatarios' });

    const linhas = [
      `Envelope: ${doc.numero || '-'}`,
      `Título: ${doc.titulo}`,
      doc.descricao ? `Descrição: ${doc.descricao}` : null,
      `Signatário (gestão): ${doc.signatario_nome || '-'}`,
      `Destinatário: ${doc.destinatario_nome || '-'}`,
      `Unidade de negócio: ${doc.unidade_negocio || '-'}`,
      `Operação: ${doc.operacao || '-'}`,
      doc.data_limite ? `Data limite: ${doc.data_limite}` : null,
      `Arquivos: ${(doc.arquivos || []).length}`,
    ].filter(Boolean).join('\n');

    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#059669">Envelope totalmente assinado</h2>
      <p>O envelope <strong>${doc.titulo}</strong> foi totalmente assinado pela diretoria${diretoriaNome ? ` (${diretoriaNome})` : ''}.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Envelope</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.numero || '-'}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Título</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.titulo}</td></tr>
        ${doc.descricao ? `<tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Descrição</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.descricao}</td></tr>` : ''}
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Signatário</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.signatario_nome || '-'}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Destinatário</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.destinatario_nome || '-'}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Unidade</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.unidade_negocio || '-'}</td></tr>
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Operação</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.operacao || '-'}</td></tr>
        ${doc.data_limite ? `<tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Data limite</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${doc.data_limite}</td></tr>` : ''}
        <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:600;border:1px solid #e5e5e5">Arquivos</td><td style="padding:6px 12px;border:1px solid #e5e5e5">${(doc.arquivos || []).length} arquivo(s)</td></tr>
      </table>
      <p style="color:#666;font-size:13px">Os arquivos assinados estão disponíveis para exportação na plataforma.</p>
    </div>`;

    let enviados = 0;
    let via = 'plataforma';
    for (const email of emails) {
      try {
        try {
          await enviarOutlook(base44, { to: email, subject: 'Envelope totalmente assinado', html });
          via = 'outlook';
        } catch (e) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: 'Envelope totalmente assinado',
            html,
            from_name: diretoriaNome || 'Diretoria',
          });
        }
        enviados++;
      } catch (e) { /* continua para os próximos */ }
    }

    return Response.json({ ok: true, enviados, total: emails.length, via, destinatarios: emails });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}