import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, LogIn, Mail } from "lucide-react";
import { isEmailAutorizado } from "@/lib/allowlist";
import { nomeDoUsuario } from "@/lib/permissoes";
import { salvarSessaoLink } from "@/lib/acessoLink";

export default function IdentificacaoEmail({ returnTo = "/" }) {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");

  const acessar = (e) => {
    e.preventDefault();
    const valor = email.trim().toLowerCase();
    if (!valor) {
      setErro("Informe seu e-mail.");
      return;
    }
    if (!isEmailAutorizado(valor)) {
      setErro("E-mail não autorizado. Confirme com o administrador.");
      return;
    }
    setErro("");
    salvarSessaoLink({ email: valor, nome: nomeDoUsuario({ email: valor }) || "" });
    window.location.href = returnTo || "/";
  };

  return (
    <form onSubmit={acessar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email-identificacao">Seu e-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="email-identificacao"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="seu@logmam.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 h-12"
            required
          />
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      <Button type="submit" className="w-full h-12 gap-2 bg-brand text-white hover:bg-brand/90">
        <LogIn className="w-4 h-4" /> Acessar
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Sem senha. O acesso segue o e-mail cadastrado e as permissões do seu perfil.
      </p>
    </form>
  );
}