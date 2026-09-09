import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText, Download, Loader2, CheckCircle2, Calendar, Paperclip, PackageCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";
import { formatDate } from "@/lib/signatureUtils";
import { Image as UIImage } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";
const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function EnvelopesAssinados() {
  const [docs, setDocs] = useState([]);
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [d, s] = await Promise.all([
        base44.entities.Documento.filter({ status: "assinado_diretoria" }, "-created_date", 200),
        base44.entities.Assinatura.list("-created_date", 1000),
      ]);
      setDocs(d);
      setSigs(s);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const mastersFor = (docId) => sigs.filter((s) => s.documento_id === docId && s.etapa === "master" && s.arquivo_url);

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

  const processar = async (d) => {
    setProcessingId(d.id);
    try {
      const agora = new Date().toISOString();
      await base44.entities.Documento.update(d.id, { processado: true, data_processamento: agora });
      setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, processado: true, data_processamento: agora } : x)));
      toast({ title: "Envelope processado", description: "Acesso e processamento fiscal registrados." });
    } catch (e) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <UIImage src={LOGO_URL} alt="LOGMAM transportes" className="h-16 w-auto object-contain" />
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-emerald-600 mb-2"><PackageCheck className="w-4 h-4" /> Módulo de envelopes totalmente assinados</div>
            <h1 className="text-3xl font-heading tracking-tight">Envelopes concluídos</h1>
            <p className="text-muted-foreground mt-2">Histórico de envelopes assinados pela diretoria. Exportação individual ou em massa.</p>
          </div>
          <Button type="button" onClick={baixarTodos} disabled={downloadingAll || !docs.length} className="gap-2">
            {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar todos
          </Button>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum envelope totalmente assinado ainda.</p>
        ) : (
          <div className="space-y-4">
            {docs.map((d) => {
              const masters = mastersFor(d.id);
              return (
                <Card key={d.id} className={`rounded-2xl transition-colors ${d.processado ? "border-emerald-300 bg-emerald-50/60" : "border-border/60"}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {d.numero && <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{d.numero}</span>}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Concluído</span>
                          {d.processado && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-emerald-600 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Processado</span>}
                        </div>
                        <p className="font-medium truncate">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {d.destinatario_nome && <span>Dest.: {d.destinatario_nome}</span>}
                          {d.signatario_nome && <span>Gestão: {d.signatario_nome}</span>}
                          {d.unidade_negocio && <span>UN: {d.unidade_negocio}</span>}
                          {d.operacao && <span>Op.: {d.operacao}</span>}
                          {d.data_limite && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(d.data_limite)}</span>}
                          <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {masters.length} arquivo(s)</span>
                          {d.processado && d.data_processamento && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Processado em {new Date(d.data_processamento).toLocaleString("pt-BR")}</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => baixarUm(d)} disabled={downloadingId === d.id} className="gap-2">
                          {downloadingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar
                        </Button>
                        {!d.processado && (
                          <Button type="button" size="sm" onClick={() => processar(d)} disabled={processingId === d.id} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                            {processingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Processar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border/60 pt-3">
                      <p className="text-xs text-muted-foreground mb-2">Arquivos assinados (clique para baixar individual):</p>
                      <div className="flex flex-col gap-1.5">
                        {masters.map((m, i) => (
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
    </div>
  );
}