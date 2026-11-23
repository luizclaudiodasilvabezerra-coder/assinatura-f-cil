import { lerSessaoLink } from "@/lib/acessoLink";

// Identificação enviada às funções de backend: o e-mail informado na capa.
export const identidadeAtual = () => {
  const sessao = lerSessaoLink();
  return { emailIdentificado: sessao?.email || "", nomeIdentificado: sessao?.nome || "" };
};