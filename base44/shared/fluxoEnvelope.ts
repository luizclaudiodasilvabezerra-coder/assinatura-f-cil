import { signatarioRedirecionado, isRedirectTarget } from './redirecionamento.ts';

export const nomesPorEmail = {
  'ana@logmam.com.br': 'ANA BARCELLOS', 'anderson.duque@logmam.com.br': 'ANDERSON DUQUE',
  'matheus.santos@logmam.com.br': 'MATHEUS SANTOS', 'joselio@logmam.com.br': 'JOSELIO SERUR',
  'gilmar@logmam.com.br': 'GILMAR PEREIRA', 'jorge.queiroz@logmam.com.br': 'JORGE QUEIROZ',
  'luiz.dias@logmam.com.br': 'LUIZ DIAS', 'breno@logmam.com.br': 'BRENO',
  'jordan@logmam.com.br': 'DILSON JORDAN', 'laryssa.mattos@logmam.com.br': 'LARYSSA MATTOS'
};
export const etapaGestao = (doc) => signatarioRedirecionado(doc.signatario_nome) ? 'gestao_origem' : 'signatario';
export const podeOperarGestao = (user, doc) => {
  const email = (user.email || '').trim().toLowerCase();
  const unidade = (doc.unidade_negocio || '').trim().toLowerCase();
  return user.role === 'admin' || ['nf@logmam.com.br', 'faturas@logmam.com.br'].includes(email) ||
    (!!doc.signatario_email && email === doc.signatario_email.trim().toLowerCase()) ||
    (!!nomesPorEmail[email] && nomesPorEmail[email] === (doc.signatario_nome || '').trim().toUpperCase()) ||
    (!!doc.destinatario_email && email === doc.destinatario_email.trim().toLowerCase());
};
// Chave da página: o nome do arquivo muda a cada carimbo, reconstrução ou
// renomeação (assinado_, legivel_, reconstruido_ e o hash do upload se acumulam),
// então comparamos sempre o nome "limpo" para achar a mesma página.
const PREFIXO_UPLOAD = /^[0-9a-f]{8,10}_/i;
const PREFIXO_MARCA = /^(assinado|legivel|reconstruido|reassinar|carimbado|copia)_/i;

export const chaveArquivo = (url) => {
  if (!url) return '';
  let nome = String(url).split('/').pop() || '';
  try { nome = decodeURIComponent(nome); } catch { /* mantém como está */ }
  nome = nome.toLowerCase();
  for (let anterior = ''; anterior !== nome;) {
    anterior = nome;
    nome = nome.replace(PREFIXO_UPLOAD, '').replace(PREFIXO_MARCA, '');
  }
  return nome;
};

export const assinaturaDaPagina = (sigs, url, etapa) => {
  const alvo = chaveArquivo(url);
  if (!alvo) return undefined;
  return sigs.find((s) =>
    (s.etapa || 'signatario') === etapa && s.status === 'assinado' && s.arquivo_url &&
    (chaveArquivo(s.arquivo_original_url || s.arquivo_url) === alvo || chaveArquivo(s.arquivo_url) === alvo) &&
    !s.observacao?.startsWith('Assinatura automática')
  );
};
export const buscarAssinaturasAtivas = async (base44, doc) => {
  const sigs = [];
  if (!doc.arquivos?.length) return sigs;
  let cursor;
  do {
    // Todas as assinaturas do envelope: o vínculo com a página é feito por chaveArquivo,
    // porque os nomes dos arquivos mudam após o envio ao gestor.
    const page = await base44.entities.Assinatura.filter({ documento_id: doc.id, status: 'assinado' }, { sort: '-created_date', limit: 100, cursor });
    sigs.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return sigs;
};
export const exigirAssinaturas = (doc, sigs, parcial) => {
  const etapa = etapaGestao(doc);
  const completos = (doc.arquivos || []).map((url) => assinaturaDaPagina(sigs, url, etapa));
  const hierarquico = doc.fluxo_hierarquico || signatarioRedirecionado(doc.signatario_nome) || isRedirectTarget(doc.signatario_nome);
  // O gestor de destino (Joselio) autoriza em vez de escrever observação: vale a marcação
  // de Autorizado ou a observação iniciada por "Autorizado".
  const gestorAutoriza = !!isRedirectTarget(doc.signatario_nome);
  const autorizadoNaPagina = (s) => !!s?.autorizado || !!(s?.observacao || '').trim().startsWith('Autorizado');
  if (!completos.length || !completos.some(Boolean) ||
    ((!parcial || hierarquico) && completos.some((s) => !s || (!gestorAutoriza && !(s.observacao || '').trim())))) {
    throw new Error('Assine e informe a observação em todas as páginas antes de encaminhar.');
  }
  if (gestorAutoriza && completos.some((s) => !autorizadoNaPagina(s))) {
    throw new Error('Marque Autorizado nas páginas antes do envio à diretoria.');
  }
  return completos;
};