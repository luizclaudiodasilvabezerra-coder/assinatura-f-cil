import React, { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function RecusaNFDialog({ open, onClose, doc, arquivoUrl, onRecusou }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const fechar = () => { if (!saving) { setMotivo(""); onClose(); } };
  const recusar = async () => {
    if (!motivo.trim() || !arquivoUrl) return;
    setSaving(true);
    try {
      const { data } = await base44.functions.invoke("recusarPaginaEnvelope", { documentoId: doc.id, arquivoUrl, motivo: motivo.trim() });
      if (!data?.documento) throw new Error(data?.error || "Não foi possível recusar a NF.");
      await onRecusou(data.documento);
      setMotivo(""); onClose();
      toast({ title: "NF recusada", description: "Página devolvida à pasta de parcialmente recusados. As demais NFs continuam no fluxo." });
    } catch (e) { toast({ title: "Erro ao recusar", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) fechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar esta NF</DialogTitle>
          <DialogDescription>Somente esta página será devolvida à pasta de parcialmente recusados, com o motivo e o responsável registrados. As demais NFs seguem normalmente.</DialogDescription>
        </DialogHeader>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} rows={3} placeholder="Motivo da recusa" autoFocus disabled={saving} />
        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={recusar} disabled={saving || !motivo.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Confirmar recusa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}