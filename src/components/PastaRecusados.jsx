import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Download, FileText, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { baixarArquivoPdf } from "@/lib/pdfDownload";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function PastaRecusados({ recusados = [], documentos = [], linkPara, onExcluir, onRecuperou }) {
  const { toast } = useToast();
  const [abertos, setAbertos] = useState({});
  const [removendo, setRemovendo] = useState(null);

  const docById = useMemo(() => {
    const m = {};
    documentos.forEach((d) => { m[d.id] = d; });
    return m;
  }, [documentos]);

  const grupos = useMemo(() => {
    const m = {};
    recusados.forEach((r) => {
      if (!m[r.documento_id]) m[r.documento_id] = [];
      m[r.documento_id].push(r);
    });
    return Object.entries(m);
  }, [recusados]);

  const toggle = (id) => setAbertos((s) => ({ ...s, [id]: !s[id] }));

  const removerRecusado = async (rec) => {
    setRemovendo(rec.id);
    try {
      const d = docById[rec.documento_id];
      const arqs = d?.arquivos ? [...d.arquivos] : [];
      if (!arqs.includes(rec.arquivo_url)) arqs.push(rec.arquivo_url);
      await base44.entities.Documento.update(rec.documento_id, { arquivos: arqs });
      await base44.entities.ArquivoRecusado.delete(rec.id);
      toast({ title: "NF recuperada", description: "O arquivo voltou ao envelope." });
      onRecuperou?.();
    } catch (e) {
      toast({ title: "Erro ao recuperar NF", description: e.message, variant: "destructive" });
    } finally {
      setRemovendo(null);
    }
  };

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma NF recusada.</p>;
  }

  return (
    <div className="space-y-3">
      {grupos.map(([docId, recs]) => {
        const d = docById[docId];
        const link = d ? linkPara(d) : "#";
        const open = abertos[docId] ?? true;
        return (
          <Card key={docId} className="rounded-xl border-amber-400 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => toggle(docId)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  {open ? <ChevronDown className="w-4 h-4 text-amber-700" /> : <ChevronRight className="w-4 h-4 text-amber-700" />}
                  <Ban className="w-4 h-4 text-amber-600" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d?.titulo || recs[0]?.documento_titulo || "Envelope"}</p>
                    <p className="text-xs text-muted-foreground">{recs.length} NF recusada{recs.length > 1 ? "s" : ""}{d?.numero ? ` · ${d.numero}` : ""}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {d && <Button asChild variant="outline" size="sm"><Link to={link}>Abrir envelope</Link></Button>}
                </div>
              </div>

              {open && (
                <div className="mt-3 space-y-2">
                  {recs.map((r) => (
                    <div key={r.id} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0" /> {fileName(r.arquivo_url)}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" onClick={() => baixarArquivoPdf(r.arquivo_url, fileName(r.arquivo_url))} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Baixar
                          </button>
                          <button type="button" onClick={() => removerRecusado(r)} disabled={removendo === r.id} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline disabled:opacity-50">
                            {removendo === r.id ? "..." : <><Trash2 className="w-3.5 h-3.5" /> Recuperar</>}
                          </button>
                        </div>
                      </div>
                      {r.observacao && (
                        <p className="text-xs text-amber-800 mt-1.5"><span className="font-medium">Obs.: </span>{r.observacao}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}