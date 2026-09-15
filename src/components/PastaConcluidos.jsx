import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, CheckCircle2, Calendar, Paperclip, FolderOpen, ChevronDown, ChevronRight, CheckCheck, UserCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";
import { formatDate } from "@/lib/signatureUtils";

const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function PastaConcluidos({ titulo, docs, sigs, accent = "emerald", showProcessar = false, onProcessar, onDarBaixa }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [baixandoSelecionados, setBaixandoSelecionados] = useState(false);

  const mastersFor = (docId) => sigs.filter((s) => s.documento_id === docId && s.etapa === "master" && s.arquivo_url);

  const accentMap = {
    emerald: { border: "border-emerald-500/60", bg: "bg-emerald-50/50", chip: "bg-emerald-600 text-white", icon: "text-emerald-600", cardBorder: "border-emerald-300 bg-emerald-50/40" },
    amber: { border: "border-amber-500/60", bg: "bg-amber-50/50", chip: "bg-amber-600 text-white", icon: "text-amber-600", cardBorder: "border-amber-300 bg-amber-50/30" },
  };
  const a = accentMap[accent] || accentMap.emerald;

  const naoProcessados = docs.filter((d) => !d.processado);
  const allSelected = naoProcessados.length > 0 && selected.size === naoProcessados.length;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(naoProcessados.map((d) => d.id)));
  };

  const darBaixaSelecionados = async () => {
    if (!onDarBaixa || selected.size === 0) return;
    setBaixandoSelecionados(true);
    try {
      await onDarBaixa(Array.from(selected));
      setSelected(new Set());
    } finally {
      setBaixandoSelecionados(false);
    }
  };

  const baixarUm = async (d) => {
    setDownloadingId(d.id);
    try { await baixarEnvelopePdf(d.id, `${d.numero || "envelope"}.pdf`); }
    catch (e) { toast({ title: "Erro ao baixar", description: e.message, variant: "destructive" }); }
    finally { setDownloadingId(null); }
  };

  const baixarTodos = async () => {
    if (!docs.length) return;
    setDownloadingAll(true);
    for (const d of docs) {
      try { await baixarEnvelopePdf(d.id, `${d.numero || "envelope"}.pdf`); }
      catch {}
    }
    setDownloadingAll(false);
    toast({ title: "Exportação em massa concluída", description: `${docs.length} envelope(s).` });
  };

  const handleProcessar = async (d) => {
    setProcessingId(d.id);
    try { await onProcessar(d); }
    finally { setProcessingId(null); }
  };

  if (!docs.length) {
    return (
      <div className={`rounded-xl border-2 ${a.border} ${a.bg} px-4 py-3 mb-4 flex items-center gap-3`}>
        <FolderOpen className={`w-5 h-5 ${a.icon}`} />
        <p className="text-sm font-medium flex-1">{titulo} — nenhum envelope.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 ${a.border} ${a.bg} mb-6 overflow-hidden`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        <FolderOpen className={`w-5 h-5 ${a.icon}`} />
        <p className="text-sm font-semibold flex-1">{titulo} · {docs.length} envelope(s)</p>
        {showProcessar && (
          <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); darBaixaSelecionados(); }} disabled={baixandoSelecionados || selected.size === 0} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {baixandoSelecionados ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />} Dar baixa ({selected.size})
          </Button>
        )}
        <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); baixarTodos(); }} disabled={downloadingAll} className="gap-2">
          {downloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar todos
        </Button>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {showProcessar && naoProcessados.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1 border-b border-border/40">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} id={`select-all-${titulo}`} />
              <label htmlFor={`select-all-${titulo}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                Selecionar todos os não processados ({naoProcessados.length})
              </label>
            </div>
          )}
          {docs.map((d) => {
            const masters = mastersFor(d.id);
            const individuais = masters.length ? masters : (d.arquivos || []).map((url, i) => ({ id: `arq-${i}`, arquivo_url: url }));
            return (
              <Card key={d.id} className={`rounded-xl ${d.processado ? "border-emerald-300 bg-emerald-50/60" : a.cardBorder}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {showProcessar && !d.processado && (
                        <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} className="mt-1" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {d.numero && <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{d.numero}</span>}
                          {d.status === "assinado_diretoria" && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Concluído</span>}
                          {d.status === "pendente_diretoria" && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pendente diretoria</span>}
                          {d.processado && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-emerald-600 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Processado</span>}
                        </div>
                        <p className="font-medium truncate">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {d.destinatario_nome && <span>Dest.: {d.destinatario_nome}</span>}
                          {d.signatario_nome && <span>Gestão: {d.signatario_nome}</span>}
                          {d.diretoria && <span>Diretoria: {d.diretoria}</span>}
                          {d.unidade_negocio && <span>UN: {d.unidade_negocio}</span>}
                          {d.operacao && <span>Op.: {d.operacao}</span>}
                          {d.data_limite && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(d.data_limite)}</span>}
                          <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {individuais.length} arquivo(s)</span>
                          {d.processado && d.data_processamento && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Processado em {new Date(d.data_processamento).toLocaleString("pt-BR")}</span>}
                          {d.processado && d.processado_por && <span className="inline-flex items-center gap-1 text-emerald-700"><UserCheck className="w-3 h-3" /> Resp.: {d.processado_por}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => baixarUm(d)} disabled={downloadingId === d.id} className="gap-2">
                        {downloadingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Envelope
                      </Button>
                      {showProcessar && !d.processado && (
                        <Button type="button" size="sm" onClick={() => handleProcessar(d)} disabled={processingId === d.id} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                          {processingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Processar
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border/60 pt-2">
                    <p className="text-xs text-muted-foreground mb-1.5">Arquivos (clique para baixar individual):</p>
                    <div className="flex flex-col gap-1">
                      {individuais.map((m, i) => (
                        <button key={m.id || i} type="button" onClick={() => baixarArquivoPdf(m.arquivo_url, fileName(m.arquivo_url))} className="flex items-center gap-2 text-sm text-blue-600 hover:underline text-left">
                          <Download className="w-3.5 h-3.5" /> {fileName(m.arquivo_url)}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}