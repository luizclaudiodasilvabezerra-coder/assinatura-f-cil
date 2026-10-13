// Regras de redirecionamento de assinatura
// Signatários cuja assinatura deve ser delegada a outro responsável no momento da criação do envelope.
// Ao criar o envelope, o signatário real é substituído pelo responsável de destino.
const REDIRECIONAMENTO = {
  "ANA BARCELLOS": "JOSELIO SERUR",
  "ANDERSON DUQUE": "JOSELIO SERUR",
  "MATHEUS SANTOS": "JOSELIO SERUR",
};

const norm = (s) => (s || "").trim().toUpperCase();

// Retorna o nome do signatário que deve efetivamente assinar, ou null se não há redirecionamento
export const signatarioRedirecionado = (nome) => {
  const key = norm(nome);
  return REDIRECIONAMENTO[key] || null;
};

// Dado um signatário selecionado e a lista de cadastros, retorna os dados
// do signatário efetivo (redirecionado) ou null quando não aplica.
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