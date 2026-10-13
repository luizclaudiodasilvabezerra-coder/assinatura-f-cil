// Regras de redirecionamento de assinatura (compartilhado entre funções backend)
export const REDIRECIONAMENTO_SIGNATARIOS = {
  "ANA BARCELLOS": "JOSELIO SERUR",
  "ANDERSON DUQUE": "JOSELIO SERUR",
  "MATHEUS SANTOS": "JOSELIO SERUR",
};

export const normNome = (s) => (s || "").trim().toUpperCase();

// Retorna o nome do signatário que deve efetivamente assinar, ou null se não há redirecionamento
export const signatarioRedirecionado = (nome) => {
  return REDIRECIONAMENTO_SIGNATARIOS[normNome(nome)] || null;
};

// Verifica se o signatário É o destino de algum redirecionamento (ex: próprio Joselio Serur)
export const isRedirectTarget = (nome) => {
  const n = normNome(nome);
  return Object.values(REDIRECIONAMENTO_SIGNATARIOS).includes(n) ? n : null;
};

// Retorna o nome do signatário efetivo para auto-assinatura, ou null se não aplica.
// Cobrem dois cenários: signatário é FONTE do redirecionamento (Ana/Anderson/Matheus → Joselio)
// ou signatário JÁ É o destino (próprio Joselio, selecionado direto ou via redirect legado).
export const resolverAutoAssinatura = (nome) => {
  return signatarioRedirecionado(nome) || isRedirectTarget(nome);
};