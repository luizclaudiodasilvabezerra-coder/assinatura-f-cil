import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldX } from "lucide-react";
import { salvarSessaoLink } from "@/lib/acessoLink";

export default function AcessoLink() {
  const { token } = useParams();
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await base44.functions.invoke("validarLinkAcesso", { token });
        if (!ativo) return;
        salvarSessaoLink({ email: res.data.email, nome: res.data.nome, token });
        window.location.href = "/";
      } catch {
        if (ativo) setErro(true);
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
            <ShieldX className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-heading mb-2">Link inválido</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Este link de acesso não existe ou foi desativado. Solicite um novo link ao administrador.
          </p>
          <Link to="/capa" className="text-sm text-primary font-medium hover:underline">
            Ir para a tela de acesso
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
      <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Validando seu acesso…</p>
    </div>
  );
}