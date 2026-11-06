import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const nomeArquivo = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "arquivo");

export default function SenhaPdfDialog({ open, arquivo, erro, onConfirmar, onCancelar }) {
  const [senha, setSenha] = useState("");

  useEffect(() => {
    if (open) setSenha("");
  }, [open, arquivo]);

  const confirmar = () => {
    if (!senha) return;
    onConfirmar(senha);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4" /> PDF protegido por senha</DialogTitle>
          <DialogDescription>
            O arquivo <span className="font-medium">{nomeArquivo(arquivo)}</span> está protegido. Informe a senha do PDF para gravar a assinatura e a observação.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha do PDF"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
        />
        {erro && <p className="text-sm text-destructive">Senha incorreta. Tente novamente.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!senha} className="gap-2"><Lock className="w-4 h-4" /> Abrir e assinar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}