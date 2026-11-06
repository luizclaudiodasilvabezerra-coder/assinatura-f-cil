// Erro sinalizado pelo backend quando o PDF está protegido por senha.
// `precisaSenha` permite ao fluxo de assinatura pedir a senha e tentar novamente.
export class SenhaPdfError extends Error {
  constructor(message, incorreta) {
    super(message || "PDF protegido por senha.");
    this.name = "SenhaPdfError";
    this.precisaSenha = true;
    this.senhaIncorreta = !!incorreta;
  }
}

export const erroSenhaPdf = (data) =>
  data?.senha_pdf ? new SenhaPdfError(data.error, data.senha_incorreta) : null;