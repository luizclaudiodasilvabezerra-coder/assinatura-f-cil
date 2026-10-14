// Hierarquia manual: origem assina com observação, Joselio autoriza e assina,
// e somente depois o envelope segue para a diretoria.
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

// Mantido por compatibilidade; a assinatura automática está desativada.
export const resolverAutoAssinatura = () => null;