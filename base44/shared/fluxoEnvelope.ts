import { signatarioRedirecionado, isRedirectTarget } from './redirecionamento.ts';

export const nomesPorEmail = {
  'ana@logmam.com.br': 'ANA BARCELLOS', 'anderson.duque@logmam.com.br': 'ANDERSON DUQUE',
  'matheus.santos@logmam.com.br': 'MATHEUS SANTOS', 'joselio@logmam.com.br': 'JOSELIO SERUR',
  'gilmar@logmam.com.br': 'GILMAR PEREIRA', 'jorge.queiroz@logmam.com.br': 'JORGE QUEIROZ',
  'luiz.dias@logmam.com.br': 'LUIZ DIAS', 'breno@logmam.com.br': 'BRENO'
};
export const etapaGestao = (doc) => signatarioRedirecionado(doc.signatario_nome) ? 'gestao_origem' : 'signatario';
export const podeOperarGestao = (user, doc) => {
  const email = (user.email || '').trim().toLowerCase();
  return user.role === 'admin' || ['nf@logmam.com.br', 'faturas@logmam.com.br'].includes(email) ||
    (!!doc.signatario_email && email === doc.signatario_email.trim().toLowerCase()) ||
    (!!nomesPorEmail[email] && nomesPorEmail[email] === (doc.signatario_nome || '').trim().toUpperCase());
};
export const assinaturaDaPagina = (sigs, url, etapa) => sigs.find((s) =>
  (s.etapa || 'signatario') === etapa && s.status === 'assinado' && s.arquivo_url &&
  (s.arquivo_original_url || s.arquivo_url) === url && !s.observacao?.startsWith('Assinatura automática')
);
export const buscarAssinaturasAtivas = async (base44, doc) => {
  const sigs = [];
  if (!doc.arquivos?.length) return sigs;
  let cursor;
  do {
    const page = await base44.entities.Assinatura.filter({ documento_id: doc.id, status: 'assinado',
      $or: [{ arquivo_original_url: { $in: doc.arquivos } }, { arquivo_url: { $in: doc.arquivos } }]
    }, { sort: '-created_date', limit: 100, cursor });
    sigs.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return sigs;
};
export const exigirAssinaturas = (doc, sigs, parcial) => {
  const etapa = etapaGestao(doc);
  const completos = (doc.arquivos || []).map((url) => assinaturaDaPagina(sigs, url, etapa));
  const hierarquico = doc.fluxo_hierarquico || signatarioRedirecionado(doc.signatario_nome) || isRedirectTarget(doc.signatario_nome);
  if (!completos.length || !completos.some(Boolean) || ((!parcial || hierarquico) && completos.some((s) => !s || !s.observacao?.trim()))) {
    throw new Error('Assine e informe a observação em todas as páginas antes de encaminhar.');
  }
  if (isRedirectTarget(doc.signatario_nome) && completos.some((s) => !s?.autorizado || !(s.observacao || '').startsWith('Autorizado'))) {
    throw new Error('Joselio deve marcar Autorizado e assinar todas as páginas antes do envio à diretoria.');
  }
  return completos;
};