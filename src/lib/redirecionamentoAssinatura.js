// Hierarquia manual: origem assina com observação, Joselio autoriza e assina,
// e somente depois o envelope segue para a diretoria.
const REDIRECIONAMENTO = {
  "ANA BARCELLOS": "JOSELIO SERUR",
  "ANDERSON DUQUE": "JOSELIO SERUR",
  "MATHEUS SANTOS": "JOSELIO SERUR",
};

const norm = (s) => (s || "").trim().toUpperCase();

// Retorna o nome do destino (ex.: Joselio Serur) quando o signatário é FONTE do redirecionamento.
export const signatarioRedirecionado = (nome) => {
  const key = norm(nome);
  return REDIRECIONAMENTO[key] || null;
};

// Verifica se o signatário É o destino de redirecionamento (ex.: próprio Joselio Serur)
export const isRedirectTarget = (nome) => {
  const n = norm(nome);
  return Object.values(REDIRECIONAMENTO).includes(n) ? n : null;
};

// Auto-carimbo desativado: todas as etapas exigem assinatura manual.
export const deveAutoAssinar = () => false;

// Dado um signatário-fonte e a lista de cadastros, retorna os dados do destino
// (Joselio Serur) para reatribuição do envelope.
export const resolverSignatarioEfetivo = (nome, cadastros) => {
  const destino = signatarioRedirecionado(nome);
  if (!destino) return null;
  const c = cadastros.find(
    (x) => norm(x.nome) === destino && ["signatario", "destinatario", "ambos"].includes(x.tipo)
  );
  return {
    nome: c ? c.nome : destino,
    email: c?.email || "",
    cadastro_id: c?.id || "",
  };
};