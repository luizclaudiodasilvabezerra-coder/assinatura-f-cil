import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({})) || {};
    const destinatario = body.email || 'fiscal@logmam.com.br';

    const docs = await base44.asServiceRole.entities.Documento.filter(
      { status: 'assinado_diretoria', pasta: 'assinados' },
      '-created_date',
      200
    );
    const pendentes = docs.filter((d) => !d.processado);
    if (pendentes.length === 0) {
      return Response.json({ ok: true, enviados: 0, motivo: 'sem pendentes', destinatario });
    }

    const tabela = pendentes.map((d) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e5e5e5;font-family:monospace">${d.numero || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e5e5e5">${d.titulo}</td>
        <td style="padding:6px 10px;border:1px solid #e5e5e5">${d.destinatario_nome || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e5e5e5">${d.unidade_negocio || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e5e5e5">${d.operacao || '-'}</td>
        <td style="padding:6px 10px;border:1px solid #e5e5e5;text-align:center">${(d.arquivos || []).length}</td>
      </tr>`).join('');

    const html = `<div style="font-family:sans-serif;max-width:720px;margin:0 auto">
      <h2 style="color:#059669">Envelopes assinados - pendentes de processamento fiscal</h2>
      <p>Existem <strong>${pendentes.length} envelope(s)</strong> totalmente assinados pela diretoria aguardando processamento.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
        <tr style="background:#f5f5f5">
          <th style="padding:6px 10px;border:1px solid #e5e5e5;text-align:left">Envelope</th>
          <th style="padding:6px 10px;border:1px solid #e5e5e5;text-align:left">Título</th>
          <th style="padding:6px 10px;border:1px solid #e5e5e5;text-align:left">Destinatário</th>
          <th style="padding:6px 10px;border:1px solid #e5e5e5;text-align:left">Unidade</th>
          <th style="padding:6px 10px;border:1px solid #e5e5e5;text-align:left">Operação</th>
          <th style="padding:6px 10px;border:1px solid #e5e5e5;text-align:left">Arquivos</th>
        </tr>
        ${tabela}
      </table>
      <p style="color:#666;font-size:12px">Envelopes não processados serão reenviados no próximo ciclo (12:00 e 16:00).</p>
    </div>`;

    const subject = `Alerta fiscal: ${pendentes.length} envelope(s) pendente(s) de processamento`;
    let via = 'plataforma';
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('outlook');
      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: destinatario } }],
          },
        }),
      });
      if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
      via = 'outlook';
    } catch (e) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: destinatario,
        subject,
        html,
        from_name: 'Assinatura Fácil - LOGMAM',
      });
    }

    return Response.json({ ok: true, enviados: 1, total: pendentes.length, destinatario, via });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}