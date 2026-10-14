import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assinaturaDaPagina, buscarAssinaturasAtivas, etapaGestao, podeOperarGestao, nomesPorEmail } from '../../shared/fluxoEnvelope.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { documentoId, arquivoUrl, motivo } = await req.json();
    if (typeof documentoId !== 'string' || !documentoId || typeof arquivoUrl !== 'string' || typeof motivo !== 'string' || !motivo.trim() || motivo.length > 2000) return Response.json({ error: 'Documento, página e motivo são obrigatórios' }, { status: 400 });
    const doc = await base44.entities.Documento.get(documentoId);
    if (!doc.arquivos?.includes(arquivoUrl) || doc.recusado || !['pendente_gestao', 'assinado_gestao', 'pendente_diretoria'].includes(doc.status)) return Response.json({ error: 'Página fora do fluxo de assinatura' }, { status: 400 });
    const diretoria = doc.status === 'pendente_diretoria';
    let responsavel = doc.signatario_nome;
    if (diretoria && user.role !== 'admin') {
      const nomeDiretor = nomesPorEmail[(user.email || '').trim().toLowerCase()];
      const identidade = nomeDiretor ? { $or: [{ email: user.email }, { nome: { $regex: `^${nomeDiretor}\\s*$`, $options: 'i' } }] } : { email: user.email };
      const { items } = await base44.entities.Cadastro.filter({ ...identidade, tipo: 'diretoria', diretoria: doc.diretoria }, { limit: 1 });
      if (!items[0]) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });
      responsavel = items[0].nome;
    } else if (!diretoria && !podeOperarGestao(user, doc)) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });
    if (diretoria && user.role === 'admin') responsavel = user.full_name || user.email;
    const sigs = await buscarAssinaturasAtivas(base44, doc);
    const gestao = assinaturaDaPagina(sigs, arquivoUrl, etapaGestao(doc));
    const master = assinaturaDaPagina(sigs, arquivoUrl, 'master');
    await base44.entities.ArquivoRecusado.create({
      documento_id: doc.id, documento_titulo: doc.titulo,
      arquivo_url: master?.arquivo_url || gestao?.arquivo_url || arquivoUrl,
      observacao: motivo.trim(), gestor: responsavel, data_recusa: new Date().toISOString()
    });
    const arquivos = doc.arquivos.filter((url) => url !== arquivoUrl);
    const lotes = (doc.lotes || []).map((l) => ({ ...l, arquivos: (l.arquivos || []).filter((url) => url !== arquivoUrl) })).filter((l) => l.arquivos.length);
    let status = doc.status;
    if (!arquivos.length) status = 'arquivado';
    else if (diretoria && arquivos.every((url) => assinaturaDaPagina(sigs, url, 'master'))) status = 'assinado_diretoria';
    else if (!diretoria && arquivos.every((url) => assinaturaDaPagina(sigs, url, etapaGestao(doc)))) status = 'assinado_gestao';
    const documento = await base44.entities.Documento.update(doc.id, { arquivos, lotes, status, pasta: status === 'assinado_diretoria' ? 'assinados' : 'pendente' });
    return Response.json({ documento });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}