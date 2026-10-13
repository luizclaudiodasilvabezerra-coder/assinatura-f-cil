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