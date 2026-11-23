import React from "react";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { nomeExibicao } from "@/lib/permissoes";
import { limparSessaoLink } from "@/lib/acessoLink";
import { Button } from "@/components/ui/button";

export default function UsuarioIdentificado() {
  const { user } = useAuth();
  const nome = nomeExibicao(user) || user?.email || "";

  const trocar = () => {
    limparSessaoLink();
    window.location.href = "/capa";
  };

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <UserRound className="w-4 h-4" aria-hidden="true" />
      <span className="max-w-[180px] truncate">{nome}</span>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={trocar}>
        <LogOut className="w-4 h-4" /> Trocar
      </Button>
    </div>
  );
}