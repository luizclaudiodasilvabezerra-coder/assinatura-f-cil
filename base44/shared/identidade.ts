// O app identifica o usuário pelo e-mail informado na capa (não há senha).
// Quando existe sessão da plataforma, ela é usada; caso contrário, vale o e-mail
// identificado enviado pelo app — as regras de permissão continuam sendo aplicadas
// em cada função.
export const identificarChamador = async (base44, dados) => {
  const sessao = await base44.auth.me().catch(() => null);
  if (sessao?.email) return sessao;
  const email = String(dados?.emailIdentificado || '').trim().toLowerCase();
  if (!email || !email.includes('@') || email.length > 200) return null;
  return {
    id: `link:${email}`,
    email,
    full_name: String(dados?.nomeIdentificado || '').trim(),
    role: 'user',
  };
};