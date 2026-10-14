import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { waitUntil } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, token, fileUrl, fileBase64, fileName } = body;

    if (!token) return Response.json({ error: "Token obrigatório" }, { status: 400 });

    const sessions = await base44.asServiceRole.entities.CapturaMobile.filter({ token });
    if (!sessions.length) return Response.json({ error: "Sessão não encontrada" }, { status: 404 });
    const session = sessions[0];

    if (session.status === "concluido" || session.status === "cancelado") {
      return Response.json({ error: "Sessão encerrada", status: session.status }, { status: 400 });
    }

    // GET — retorna dados da sessão
    if (action === "get") {
      return Response.json({ session });
    }

    // ADDFILE — adiciona arquivo (URL já enviada pelo cliente, ou base64 para upload no backend)
    if (action === "addFile") {
      let url = fileUrl;
      if (!url && fileBase64) {
        const matches = fileBase64.match(/^data:(.+);base64,(.*)$/);
        if (!matches) return Response.json({ error: "Formato de arquivo inválido" }, { status: 400 });
        const mimeType = matches[1];
        const base64Data = matches[2];
        const ext = mimeType === "application/pdf" ? "pdf" : "jpg";
        const fname = fileName || `captura-${Date.now()}.${ext}`;
        const raw = atob(base64Data);
        const buffer = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
        const blob = new Blob([buffer], { type: mimeType });
        const result = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file: blob });
        url = result.file_url;
      }
      if (!url) return Response.json({ error: "Arquivo obrigatório" }, { status: 400 });
      const arquivos = [...(session.arquivos || []), url];
      const updated = await base44.asServiceRole.entities.CapturaMobile.update(session.id, { arquivos, status: "capturando" });
      return Response.json({ file_url: url, arquivos: updated.arquivos });
    }

    // REMOVEFILE — remove um arquivo da sessão
    if (action === "removeFile") {
      const arquivos = (session.arquivos || []).filter((u) => u !== fileUrl);
      const updated = await base44.asServiceRole.entities.CapturaMobile.update(session.id, { arquivos });
      return Response.json({ arquivos: updated.arquivos });
    }

    // CONCLUIR — cria o Document e envia para assinatura do gestor
    if (action === "concluir") {
      if (!session.arquivos || session.arquivos.length === 0) {
        return Response.json({ error: "Nenhum arquivo capturado" }, { status: 400 });
      }
      const all = await base44.asServiceRole.entities.Documento.list("-created_date", 1000);
      const numero = `ENV-${String((all.length || 0) + 1).padStart(4, "0")}`;
      const doc = await base44.asServiceRole.entities.Documento.create({
        titulo: session.titulo || "Envelope mobile",
        descricao: session.descricao,
        numero,
        arquivos: session.arquivos,
        status: "pendente_gestao",
        pasta: "pendente",
        categoria: session.categoria || "notas_boletos",
        destinatario_nome: session.destinatario_nome,
        destinatario_email: session.destinatario_email,
        signatario_nome: session.signatario_nome,
        signatario_email: session.signatario_email,
        signatario_cadastro_id: session.signatario_cadastro_id,
        diretoria: session.diretoria,
        unidade_negocio: session.unidade_negocio,
        data_limite: session.data_limite,
      });
      await base44.asServiceRole.entities.CapturaMobile.update(session.id, {
        status: "concluido",
        documento_criado_id: doc.id,
      });
      if (doc.destinatario_email) {
        waitUntil(base44.asServiceRole.functions.invoke("enviarAlertaDestinatario", { documentoId: doc.id }).catch(() => {}));
      }
      // O signatário de origem assina manualmente antes do envio ao gestor.
      return Response.json({ documento: doc, numero });
    }

    return Response.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}