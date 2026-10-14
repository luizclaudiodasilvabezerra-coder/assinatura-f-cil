import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo").slice(0, 40) : "arquivo");

export default function DuplicidadeDialog({ open, duplicidades = [], onConfirm, onCancel, criando }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Duplicidade detectada
          </DialogTitle>
          <DialogDescription>
            Foram encontradas NFs/boletos já anexados em outros envelopes (assinados ou pendentes). Revise a crítica antes de prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-2 py-1">
          {duplicidades.map((d, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium text-amber-900">
                NF {d.numero_nf} · {fileName(d.arquivo_novo)}
              </div>
              <div className="text-amber-800 mt-1">
                Já existe no envelope <strong>{d.existente_documento_titulo || "—"}</strong>
                {d.existente_numero ? ` (${d.existente_numero})` : ""}
                {d.existente_status ? ` · ${d.existente_status.replace(/_/g, " ")}` : ""}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={criando}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={criando} className="gap-2">
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Criar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}