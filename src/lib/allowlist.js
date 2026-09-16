// Allowlist de e-mails autorizados a acessar o app (além do administrador)
export const EMAILS_AUTORIZADOS = [
  "luiz.dias@logmam.com.br",
  "jorge.queiroz@logmam.com.br",
  "breno@logmam.com.br",
  "gilmar@logmam.com.br",
  "jerusa.dias@logmam.com.br",
  "nf@logmam.com.br",
  "financeiro@logmam.com.br",
  "luiz.bezerra@logmam.com.br",
  "joselio@logmam.com.br",
  "silvana@logmam.com.br",
  "luizclaudiodasilvabezerra@gmail.com",
  "compras@logmam.com.br",
];

const norm = (s) => (s || "").trim().toLowerCase();

export const isEmailAutorizado = (email) =>
  EMAILS_AUTORIZADOS.some((e) => norm(e) === norm(email));

// Admin (role "admin") sempre tem acesso, independente da allowlist
export const podeAcessarApp = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isEmailAutorizado(user.email);
};