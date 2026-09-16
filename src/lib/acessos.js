// Módulo central de senhas e acessos por papel

// Senha master para acessar/alterar envelopes com NF recusada
export const SENHA_MASTER_RECUSA = "LOG@2026";

// Senha para autorização manual de conclusão sem assinatura da diretoria
export const SENHA_AUTORIZACAO_MANUAL = "ASS@LOG";

// Part 1 — Concluídos (Financeiro / Fiscal)
export const SENHA_CONCLUIDOS = {
  financeiro: "LOG@FIN",
  fiscal: "LOG@FISCAL1",
  abastecimento: "LOG@ABAST",
};

export const CONCLUIDOS_LABEL = {
  financeiro: "Concluídos Financeiro",
  fiscal: "Concluídos Fiscal",
  abastecimento: "Concluídos Abastecimento",
};

// Part 2 — Senhas individuais dos gestores (signatários)
export const GESTORES_SENHAS = {
  "GILMAR PEREIRA": "LOG@GILMARP",
  "JOSELIO SERUR": "LOG@JOSELIO@",
  "SILVANA SACHI": "LOG@SILVANASACHI",
  "MATHEUS SANTOS": "LOG@MATHEUSSAN",
  "ANDERSON DUQUE": "LOG@DUQUE",
};

// Part 4 — Senhas individuais dos membros da diretoria
export const DIRETORIAS_SENHAS = {
  "JORGE QUEIROZ": "JORGE@LOG",
  "BRENO": "BRENO@LOGMAM",
  "LUIZ DIAS": "072026",
};

const norm = (s) => (s || "").trim().toUpperCase();

// Valida senha de gestor para um documento (com base no signatario_nome)
export const validarSenhaGestor = (signatarioNome, senha) => {
  const key = norm(signatarioNome);
  const esperada = GESTORES_SENHAS[key];
  if (!esperada) return { ok: false, naoConfigurado: true };
  return { ok: esperada === senha, naoConfigurado: false };
};

export const gestorTemSenha = (signatarioNome) => !!GESTORES_SENHAS[norm(signatarioNome)];

// Valida senha de diretoria: retorna o nome do diretor identificado, ou null
export const identificarDiretoria = (senha) => {
  const entry = Object.entries(DIRETORIAS_SENHAS).find(([, s]) => s === senha);
  return entry ? entry[0] : null;
};

// Dado um nome de diretor e a lista de cadastros, descobre a diretoria dele
export const diretoriaDoMembro = (nome, cadastros) => {
  const c = cadastros.find((x) => norm(x.nome) === norm(nome) && x.tipo === "diretoria");
  return c?.diretoria || null;
};

// Valida senha dos concluídos por tipo
export const validarSenhaConcluidos = (tipo, senha) => {
  const esperada = SENHA_CONCLUIDOS[tipo];
  if (!esperada) return false;
  return esperada === senha;
};