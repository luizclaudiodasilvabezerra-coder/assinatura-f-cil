import React from "react";
import { Button } from "@/components/ui/button";

// Mostra o erro em vez de deixar a tela em branco, para o usuário conseguir
// recarregar e reportar o motivo exato da falha.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro ao exibir a tela:", erro, info?.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    const detalhe = String(this.state.erro?.stack || this.state.erro?.message || this.state.erro);
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-lg space-y-4">
          <h1 className="text-xl font-heading">Não foi possível exibir esta tela</h1>
          <p className="text-sm text-muted-foreground">
            O que já foi salvo está preservado. Recarregue a página para continuar; se o erro voltar, envie o texto abaixo.
          </p>
          <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words">
            {detalhe.slice(0, 2000)}
          </pre>
          <div className="flex gap-2">
            <Button type="button" onClick={() => window.location.reload()}>Recarregar</Button>
            <Button asChild variant="outline"><a href="/">Ir para o painel</a></Button>
          </div>
        </div>
      </div>
    );
  }
}