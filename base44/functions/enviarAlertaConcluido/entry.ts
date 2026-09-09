import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
      `Unidade de negócio: ${doc.unidade_negocio || '-'}`,
      `Operação: ${doc.operacao || '-'}`,
      `Arquivos: ${(doc.arquivos || []).length}`,
    ].filter(Boolean).join('\n');

    const html = `<div style="font-family:sans-serif"><p>O envelope <strong>${doc.titulo}</strong> foi <strong>totalmente assinado</strong> pela diretoria.</p><pre style="white-space:pre-wrap;font-family:sans-serif;background:#f5f5f5;padding:12px;border-radius:8px">${linhas}</pre><p>Os arquivos assinados estão disponíveis para exportação na plataforma.</p></div>`;

    let enviados = 0;
    for (const email of emails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: 'Envelope totalmente assinado',
          html,
          from_name: diretoriaNome || 'Diretoria',
        });
        enviados++;
      } catch (e) { /* continua para os próximos */ }
    }

    return Response.json({ ok: true, enviados, total: emails.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}