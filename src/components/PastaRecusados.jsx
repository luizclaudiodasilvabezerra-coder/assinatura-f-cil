import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, FileText, ChevronDown, ChevronRight, FilePlus2, Loader2, User, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

const formatData = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function PastaRecusados({ recusados = [], documentos = [], linkPara, onExcluir, onRecuperou }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [abertos, setAbertos] = useState({});
  const [gerando, setGerando] = useState(null);

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

  const inserirNovoEnvelope = async (rec) => {
    setGerando(rec.id);
    try {
      const d = docById[rec.documento_id];
      const novo = await base44.entities.Documento.create({
        titulo: d?.titulo ? `${d.titulo} (reenvio)` : "Envelope reenvio",
        descricao: d?.descricao || "",
        numero: d?.numero || "",
        arquivos: [rec.arquivo_url],
        status: "pendente_gestao",
        pasta: "pendente",
        destinatario_nome: d?.destinatario_nome || "",
        destinatario_email: d?.destinatario_email || "",
        signatario_nome: d?.signatario_nome || "",
        signatario_email: d?.signatario_email || "",
        signatario_cadastro_id: d?.signatario_cadastro_id || "",
        diretoria: d?.diretoria || "",
        unidade_negocio: d?.unidade_negocio || "",
        operacao: d?.operacao || "",
        data_limite: d?.data_limite || "",
        processado: false,
        recusado: false,
        observacao_recusa: "",
      });
      await base44.entities.ArquivoRecusado.delete(rec.id);
      toast({ title: "Novo envelope criado", description: "A NF recusada foi inserida em um novo envelope." });
      onRecuperou?.();
      navigate(`/assinar/${novo.id}`);
    } catch (e) {
      toast({ title: "Erro ao gerar envelope", description: e.message, variant: "destructive" });
    } finally {
      setGerando(null);
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
                          <button type="button" onClick={() => inserirNovoEnvelope(r)} disabled={gerando === r.id} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline disabled:opacity-50">
                            {gerando === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />} Inserir em novo envelope
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-amber-900">
                        {r.gestor && (
                          <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> Recusado por: <span className="font-medium">{r.gestor}</span></span>
                        )}
                        {r.data_recusa && (
                          <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatData(r.data_recusa)}</span>
                        )}
                      </div>
                      {r.observacao && (
                        <p className="text-xs text-amber-800 mt-1"><span className="font-medium">Obs.: </span>{r.observacao}</p>
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