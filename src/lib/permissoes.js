// Controle de acesso por e-mail (RBAC)
// Mapeia e-mail → nome (para buscar diretoria/gestor no Cadastro)
const EMAIL_PARA_NOME = {
  "jorge.queiroz@logmam.com.br": "JORGE QUEIROZ",
  "luiz.dias@logmam.com.br": "LUIZ DIAS",
  "breno@logmam.com.br": "BRENO",
  "gilmar@logmam.com.br": "GILMAR PEREIRA",
  "faturas@logmam.com.br": "TAMIRES",
  "nf@logmam.com.br": "RAYANE",
  "ana@logmam.com.br": "ANA BARCELLOS",
  "anderson.duque@logmam.com.br": "ANDERSON DUQUE",
  "matheus.santos@logmam.com.br": "MATHEUS SANTOS",
  "joselio@logmam.com.br": "JOSELIO SERUR",
  "laryssa.mattos@logmam.com.br": "LARYSSA MATTOS",
};

// Permissões por e-mail
const PERMISSOES = {
  "jorge.queiroz@logmam.com.br": { tipo: "diretoria" },
  "luiz.dias@logmam.com.br": { tipo: "diretoria" },
  "breno@logmam.com.br": { tipo: "diretoria" },
  "nf@logmam.com.br": { tipo: "operacional", podeCriarEnvelope: true, podeExcluirEnvelope: true, podeVerPainel: true, concluidos: ["financeiro"] },
  "financeiro@logmam.com.br": { tipo: "operacional", concluidos: ["fiscal", "financeiro"] },
  "gilmar@logmam.com.br": { tipo: "gestor" },
  "ana@logmam.com.br": { tipo: "gestor", podeCriarEnvelope: true },
  "anderson.duque@logmam.com.br": { tipo: "gestor", podeCriarEnvelope: true },
  "matheus.santos@logmam.com.br": { tipo: "gestor", podeCriarEnvelope: true },
  "joselio@logmam.com.br": { tipo: "gestor" },
  "jerusa.dias@logmam.com.br": { tipo: "operacional", concluidos: ["financeiro", "fiscal"] },
  "faturas@logmam.com.br": { tipo: "operacional", podeCriarEnvelope: true, podeExcluirEnvelope: true, podeVerPainel: true, concluidos: ["abastecimento"], criaCategoria: "abastecimento" },
  // Jordan: cria envelopes (notas/boletos e abastecimento), exclui e acompanha os que ele gerou + envelopes das unidades dele (RJ e ES)
  "jordan@logmam.com.br": { tipo: "operacional", podeCriarEnvelope: true, podeVerPainel: true, podeExcluirEnvelope: true, apenasProprios: true, unidadesPermitidas: ["Rio de Janeiro", "Espirito Santo"] },
  // Laryssa: mesmo perfil do Jordan (conta própria)
  "laryssa.mattos@logmam.com.br": { tipo: "operacional", podeCriarEnvelope: true, podeVerPainel: true, podeExcluirEnvelope: true, apenasProprios: true, unidadesPermitidas: ["Rio de Janeiro", "Espirito Santo"] },
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

// Nome para exibição em Title Case (ex: "LUIZ DIAS" -> "Luiz Dias")
export const nomeExibicao = (user) => {
  const nome = nomeDoUsuario(user);
  if (!nome) return null;
  return nome.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

// Cadastros: acesso exclusivo do administrador (desenvolvedor) do app
export const podeVerCadastros = (user) => getPermissoes(user)?.tipo === "admin";
export const podeVerLog = (user) => getPermissoes(user)?.tipo === "admin";
export const podeVerRelatorios = (user) => !!getPermissoes(user);

// Etapas visíveis no painel
export const stagesPermitidos = (user) => {
  const p = getPermissoes(user);
  if (!p) return [];
  if (p.tipo === "admin") return ["all", "pendente_gestao", "assinado_gestao", "pendente_diretoria", "recusados"];
  if (p.tipo === "diretoria") return ["pendente_diretoria"];
  if (p.tipo === "gestor") return ["pendente_gestao", "assinado_gestao"];
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
    // Inclui os envelopes em que ele é o signatário atual e também os que ele originou
    // (signatário de origem) e já seguiram para Joselio Serur.
    const nome = nomeDoUsuario(user);
    return docs.filter((d) => nome && ((d.signatario_nome || "").trim().toUpperCase() === nome
      || (d.signatario_origem_nome || "").trim().toUpperCase() === nome));
  }
  // Jordan: acompanha os envelopes que ele mesmo criou + os das unidades permitidas (RJ e ES)
  if (p.tipo === "operacional" && p.apenasProprios) {
    const unidades = (p.unidadesPermitidas || []).map(norm);
    return docs.filter((d) =>
      d.created_by_id === user.id ||
      unidades.includes(norm(d.unidade_negocio))
    );
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

// Pode executar a exportação para o diretório de rede (Z:\Financeiro)
// nf@ e financeiro@ têm acesso direto ao diretório pela máquina local
export const podeExportarFinanceiro = (user) => {
  const p = getPermissoes(user);
  if (!p) return false;
  if (p.tipo === "admin") return true;
  const email = norm(user?.email);
  return email === "nf@logmam.com.br" || email === "financeiro@logmam.com.br";
};

// Jordan/Laryssa (apenasProprios): criam envelopes, visualizam o painel e consultam os envelopes (somente leitura)
export const somenteVisualizaPainel = (user) => {
  const p = getPermissoes(user);
  return !!(p?.tipo === "operacional" && p.apenasProprios);
};

// Consulta interna: abre o envelope em modo somente leitura (sem assinar, enviar ou recusar)
export const somenteConsultaEnvelopes = (user) => {
  const p = getPermissoes(user);
  return !!(p?.tipo === "operacional" && p.apenasProprios);
};

// Nome cadastrado do usuário, normalizado para comparação com os campos do envelope
const nomeNormalizado = (user) => {
  const nome = nomeDoUsuario(user);
  return nome ? nome.trim().toUpperCase() : null;
};

// Usuário é o signatário de ORIGEM do envelope: já assinou a própria etapa
// e o envelope seguiu para o gestor (ex.: Joselio Serur).
export const souSignatarioDeOrigem = (user, doc) => {
  if (!user || !doc) return false;
  const nome = nomeNormalizado(user);
  if (!nome) return false;
  const origem = (doc.signatario_origem_nome || "").trim().toUpperCase();
  const atual = (doc.signatario_nome || "").trim().toUpperCase();
  return !!origem && origem === nome && atual !== nome;
};

// Pode assinar um envelope na etapa gestao (como signatário atual ou de origem)
export const podeAssinarGestao = (user, doc) => {
  const p = getPermissoes(user);
  if (!p || !doc) return false;
  if (p.tipo === "admin") return true;
  if (p.tipo === "operacional" && p.podeVerPainel && !p.apenasProprios) return true;
  if (p.tipo === "gestor") {
    const nome = nomeNormalizado(user);
    if (!nome) return false;
    const atual = (doc.signatario_nome || "").trim().toUpperCase();
    const origem = (doc.signatario_origem_nome || "").trim().toUpperCase();
    return atual === nome || origem === nome;
  }
  return false;
};

// Pode encaminhar o envelope da gestão: gestor responsável, operacional do painel ou admin
export const podeEncaminharEnvelope = (user, doc) => {
  const p = getPermissoes(user);
  if (!p || !doc) return false;
  if (p.tipo === "admin") return true;
  if (["nf@logmam.com.br", "faturas@logmam.com.br"].includes(norm(user.email))) return true;
  if (p.tipo !== "gestor") return false;
  const nome = nomeNormalizado(user);
  return !!nome && (doc.signatario_nome || "").trim().toUpperCase() === nome;
};