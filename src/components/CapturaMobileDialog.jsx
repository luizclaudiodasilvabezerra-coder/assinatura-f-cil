import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2, Smartphone, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo").slice(0, 40) : "arquivo");
const isImage = (url) => url && /\.(png|jpe?g|webp|gif)$/i.test(url);

export default function CapturaMobileDialog({ open, onClose, formData, arquivosIniciais, onConcluido }) {
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [concluido, setConcluido] = useState(false);
  const [docNumero, setDocNumero] = useState(null);
  const pollRef = useRef(null);

  // Cria a sessão ao abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const created = await base44.entities.CapturaMobile.create({
          token,
          status: "aguardando",
          categoria: formData.categoria || "notas_boletos",
          titulo: formData.titulo || "",
          descricao: formData.descricao || "",
          destinatario_nome: formData.destinatario_nome || "",
          destinatario_email: formData.destinatario_email || "",
          signatario_nome: formData.signatario_nome || "",
          signatario_email: formData.signatario_email || "",
          signatario_cadastro_id: formData.signatario_cadastro_id || "",
          diretoria: formData.diretoria || "",
          unidade_negocio: formData.unidade_negocio || "",
          data_limite: formData.data_limite || "",
          arquivos: arquivosIniciais || [],
        });
        if (!cancelled) {
          setSession(created);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          toast({ title: "Falha ao criar sessão mobile", variant: "destructive" });
        }
      }
    })();
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [open]);

  // Sincroniza arquivos em tempo real (polling a cada 2s)
  useEffect(() => {
    if (!session?.id) return;
    pollRef.current = setInterval(async () => {
      try {
        const updated = await base44.entities.CapturaMobile.get(session.id);
        setSession(updated);
        if (updated.status === "concluido") {
          setConcluido(true);
          setDocNumero(updated.documento_criado_id);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.id]);

  const captureUrl = session ? `${window.location.origin}/captura/${session.token}` : "";
  const qrUrl = session ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(captureUrl)}` : "";
  const arquivos = session?.arquivos || [];

  const copyLink = () => {
    navigator.clipboard.writeText(captureUrl);
    toast({ title: "Link copiado" });
  };

  const handleConcluido = () => {
    onConcluido?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" /> Captura via celular
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou abra o link no celular para capturar os arquivos com a câmera.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : concluido ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-600" />
            <p className="text-sm font-medium">Envelope criado e enviado para assinatura!</p>
            <Button onClick={handleConcluido}>Ir para o painel</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              {qrUrl && <img src={qrUrl} alt="QR Code" className="w-48 h-48 rounded-lg border border-border/60" />}
              <div className="flex items-center gap-2 w-full">
                <input
                  readOnly
                  value={captureUrl}
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                  onClick={(e) => e.target.select()}
                />
                <Button size="sm" variant="outline" onClick={copyLink} className="gap-1">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Arquivos capturados ({arquivos.length})
              </p>
              {arquivos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aguardando captura no celular…</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {arquivos.map((url) => (
                    <div key={url} className="flex items-center gap-2 text-xs">
                      {isImage(url) ? (
                        <img src={url} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate flex-1">{fileName(url)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Aguarde o celular concluir o envelope. Esta janela atualiza automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}