// Regras de hierarquia de assinatura (compartilhado entre funções backend).
// Signatários-fonte (Anderson/Ana/Matheus) têm suas assinaturas automaticamente carimbadas
// no momento da criação do envelope. O envelope é então reatribuído ao destino (Joselio
// Serur), que assina MANUALMENTE sobre o PDF já carimbado, avançando em seguida para a
// diretoria.
export const REDIRECIONAMENTO_SIGNATARIOS = {
  "ANA BARCELLOS": "JOSELIO SERUR",
  "ANDERSON DUQUE": "JOSELIO SERUR",
  "MATHEUS SANTOS": "JOSELIO SERUR",
};

export const normNome = (s) => (s || "").trim().toUpperCase();

// Retorna o nome do destino (ex.: Joselio Serur) quando o signatário é FONTE do redirecionamento.
export const signatarioRedirecionado = (nome) => {
  return REDIRECIONAMENTO_SIGNATARIOS[normNome(nome)] || null;
};

// Verifica se o signatário É o destino de algum redirecionamento (ex.: próprio Joselio Serur)
export const isRedirectTarget = (nome) => {
  const n = normNome(nome);
  return Object.values(REDIRECIONAMENTO_SIGNATARIOS).includes(n) ? n : null;
};

// Retorna o nome do signatário-fonte cuja assinatura deve ser carimbada automaticamente,
// ou null quando não há auto-assinatura. Apenas FONTE dispara auto-carimbo; o destino
// (Joselio Serur) assina manualmente após o redirecionamento.
export const resolverAutoAssinatura = (nome) => {
  if (signatarioRedirecionado(nome)) return normNome(nome);
  return null;
};