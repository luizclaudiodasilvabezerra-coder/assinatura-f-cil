// Sessão de acesso por link pessoal (sem login e senha)
const CHAVE = "af_link_session";

export const lerSessaoLink = () => {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const sessao = JSON.parse(raw);
    return sessao && sessao.email ? sessao : null;
  } catch {
    return null;
  }
};

export const salvarSessaoLink = (sessao) => {
  try { localStorage.setItem(CHAVE, JSON.stringify(sessao)); } catch {}
};

export const limparSessaoLink = () => {
  try { localStorage.removeItem(CHAVE); } catch {}
};

export const usuarioDaSessaoLink = (sessao) => {
  if (!sessao?.email) return null;
  return {
    id: `link:${sessao.email}`,
    email: sessao.email,
    full_name: sessao.nome || "",
    role: "user",
  };
};