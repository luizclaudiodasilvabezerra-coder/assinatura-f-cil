// Controle de acesso por e-mail (RBAC)
// Mapeia e-mail → nome (para buscar diretoria/gestor no Cadastro)
const EMAIL_PARA_NOME = {
  "jorge.queiroz@logmam.com.br": "JORGE QUEIROZ",
  "luiz.dias@logmam.com.br": "LUIZ DIAS",
  "breno@logmam.com.br": "BRENO",
  "gilmar@logmam.com.br": "GILMAR PEREIRA",
  "faturas@logmam.com.br": "TAMIRES",
  "nf@logmam.com.br": "RAYANE",
};

// Permissões por e-mail
const PERMISSOES = {
  "jorge.queiroz@logmam.com.br": { tipo: "diretoria" },
  "luiz.dias@logmam.com.br": { tipo: "diretoria" },
  "breno@logmam.com.br": { tipo: "diretoria" },
  "nf@logmam.com.br": { tipo: "operacional", podeCriarEnvelope: true, podeExcluirEnvelope: true, podeVerPainel: true, concluidos: ["financeiro"] },
  "financeiro@logmam.com.br": { tipo: "operacional", concluidos: ["fiscal"] },
  "gilmar@logmam.com.br": { tipo: "gestor" },
  "jerusa.dias@logmam.com.br": { tipo: "operacional", concluidos: ["financeiro", "fiscal"] },
  "faturas@logmam.com.br": { tipo: "operacional", podeCriarEnvelope: true, podeExcluirEnvelope: true, podeVerPainel: true, concluidos: ["abastecimento"], criaCategoria: "abastecimento" },
};

const norm = (s) => (s || "").trim().toLowerCase();

export const getPermissoes = (user) => {
  if (!user) return null;
  if (user.role === "admin") return { tipo: "admin" };
  const email = norm(user.email);
  const found = Object.keys(PERMISSOES).find((e) => norm(e) === email);
  return found ? PERMISSOES[found] : null;
};

export const nomeDoUsuario = (user) => {
  if (!user) return null;
  const email = norm(user.email);
  const found = Object.keys(EMAIL_PARA_NOME).find((e) => norm(e) === email);
  return found ? EMAIL_PARA_NOME[found] : null;
};

// Descobre a diretoria do usuário (membros da diretoria) via Cadastro
export const diretoriaDoUsuario = (user, cadastros) => {
  const nome = nomeDoUsuario(user);
  if (!nome || !cadastros) return null;
  const c = cadastros.find((x) => (x.nome || "").trim().toUpperCase() === nome && x.tipo === "diretoria");
  return c?.diretoria || null;
};

// Pode ver o painel principal (lista de envelopes)
export const podeVerPainel = (user) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin" || p.tipo === "diretoria" || p.tipo === "gestor") return true;
  if (p.tipo === "operacional") return !!p.podeVerPainel;
  return false;
};

export const podeCriarEnvelope = (user) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  return !!p.podeCriarEnvelope;
};

export const podeExcluirEnvelope = (user) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  return !!p.podeExcluirEnvelope;
};

export const podeAcessarConcluidos = (user, tipo) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  return Array.isArray(p.concluidos) && p.concluidos.includes(tipo);
};

export const podeEditarAtividadesConcluidos = (user, tipo) => podeAcessarConcluidos(user, tipo);

export const podeVerCadastros = (user) => getPermissoes(user)?.tipo === "admin";
export const podeVerLog = (user) => getPermissoes(user)?.tipo === "admin";
export const podeVerRelatorios = (user) => !!getPermissoes(user);

// Etapas visíveis no painel
export const stagesPermitidos = (user) => {
  const p = getPermissoes(user);
  if (!p) return [];
  if (p.tipo === "admin") return ["all", "pendente_gestao", "assinado_gestao", "pendente_diretoria", "recusados"];
  if (p.tipo === "diretoria") return ["pendente_diretoria"];
  if (p.tipo === "gestor") return ["pendente_gestao"];
  if (p.tipo === "operacional") return p.podeVerPainel ? ["all", "pendente_gestao", "assinado_gestao", "pendente_diretoria", "recusados"] : [];
  return [];
};

// Filtra envelopes visíveis no painel conforme o papel
export const filtrarEnvelopesVisiveis = (user, docs, cadastros) => {
  const p = getPermissoes(user);
  if (!p) return [];
  if (p.tipo === "admin") return docs;
  if (p.tipo === "diretoria") {
    const dir = diretoriaDoUsuario(user, cadastros);
    return docs.filter((d) => dir && d.diretoria === dir);
  }
  if (p.tipo === "gestor") {
    const nome = nomeDoUsuario(user);
    return docs.filter((d) => nome && (d.signatario_nome || "").trim().toUpperCase() === nome);
  }
  return docs; // operacional com podeVerPainel
};

// Pode assinar um envelope na etapa diretoria
export const podeAssinarDiretoria = (user, doc, cadastros) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  if (p.tipo !== "diretoria") return false;
  const dir = diretoriaDoUsuario(user, cadastros);
  return !!(dir && doc.diretoria === dir);
};

// Categoria de envelope que o usuário cria (notas_boletos ou abastecimento)
export const categoriaEnvelopeDoUsuario = (user) => {
  const p = getPermissoes(user);
  if (!p) return "notas_boletos";
  return p.criaCategoria || "notas_boletos";
};

// Somente usuários com criaCategoria "abastecimento" (Tamires) podem criar envelopes de abastecimento
export const podeCriarEnvelopeAbastecimento = (user) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  return p.criaCategoria === "abastecimento";
};

// Pode assinar um envelope na etapa gestao
export const podeAssinarGestao = (user, doc) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  if (p.tipo === "operacional" && p.podeVerPainel) return true;
  if (p.tipo === "gestor") {
    const nome = nomeDoUsuario(user);
    return !!(nome && (doc.signatario_nome || "").trim().toUpperCase() === nome);
  }
  return false;
};