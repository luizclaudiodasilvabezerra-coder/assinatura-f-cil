import React, { useState } from "react";
import { EMAILS_AUTORIZADOS } from "@/lib/allowlist";
import { nomeDoUsuario } from "@/lib/permissoes";
import { salvarSessaoLink } from "@/lib/acessoLink";
import { Button } from "@/components/ui/button";
import { Loader2, UserRound } from "lucide-react";

const PESSOAS = EMAILS_AUTORIZADOS
  .map((email) => ({
    email,
    nome: nomeDoUsuario({ email }) || email.split("@")[0],
  }))
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

export default function AcessoRapido({ returnTo = "/" }) {
  const [entrando, setEntrando] = useState(null);

  const entrar = (pessoa) => {
    setEntrando(pessoa.email);
    salvarSessaoLink({ email: pessoa.email, nome: pessoa.nome });
    window.location.href = returnTo || "/";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
      {PESSOAS.map((p) => (
        <Button
          key={p.email}
          type="button"
          variant="outline"
          onClick={() => entrar(p)}
          disabled={!!entrando}
          className="justify-start h-11 gap-2 text-sm font-normal"
        >
          {entrando === p.email ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserRound className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="truncate">{p.nome}</span>
        </Button>
      ))}
    </div>
  );
}