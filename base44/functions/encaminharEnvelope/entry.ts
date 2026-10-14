import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { signatarioRedirecionado } from '../../shared/redirecionamento.ts';
import { buscarAssinaturasAtivas, exigirAssinaturas, podeOperarGestao } from '../../shared/fluxoEnvelope.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { documentoId, parcial = false } = await req.json();
    if (typeof documentoId !== 'string' || !documentoId || documentoId.length > 100) return Response.json({ error: 'Documento obrigatório' }, { status: 400 });
    const doc = await base44.entities.Documento.get(documentoId);
    if (!podeOperarGestao(user, doc)) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });
    if (doc.recusado || !['pendente_gestao', 'assinado_gestao'].includes(doc.status)) return Response.json({ error: 'Envelope fora da etapa de gestão' }, { status: 400 });
    const sigs = await buscarAssinaturasAtivas(base44, doc);
    let completos;
    try { completos = exigirAssinaturas(doc, sigs, parcial === true); }
    catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
    const destino = signatarioRedirecionado(doc.signatario_nome);
    let patch = { status: 'pendente_diretoria' };
    if (destino) {
      const { items } = await base44.entities.Cadastro.filter({ nome: { $regex: '^Joselio Serur\\s*$', $options: 'i' }, tipo: { $in: ['signatario', 'destinatario', 'ambos'] } }, { limit: 1 });
      const gestor = items[0];
      if (!gestor?.email) return Response.json({ error: 'Complete o cadastro e o e-mail de Joselio Serur.' }, { status: 400 });
      const urlMap = Object.fromEntries(doc.arquivos.map((url, i) => [url, completos[i].arquivo_url]));
      patch = {
        status: 'pendente_gestao', pasta: 'pendente', fluxo_hierarquico: true,
        signatario_origem_nome: doc.signatario_nome, signatario_origem_email: doc.signatario_email || '',
        signatario_origem_cadastro_id: doc.signatario_cadastro_id || '',
        signatario_nome: gestor.nome.trim(), signatario_email: gestor.email, signatario_cadastro_id: gestor.id,
        arquivos: doc.arquivos.map((url) => urlMap[url]),
        lotes: (doc.lotes || []).map((l) => ({ ...l, arquivos: (l.arquivos || []).map((url) => urlMap[url] || url) }))
      };
    }
    const documento = await base44.entities.Documento.update(doc.id, patch);
    return Response.json({ documento });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}