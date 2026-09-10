import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Download, Loader2, CheckCircle2, Calendar, Paperclip, PackageCheck, Lock, ShieldCheck, FolderOpen, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { baixarEnvelopePdf, baixarArquivoPdf } from "@/lib/pdfDownload";
import { formatDate } from "@/lib/signatureUtils";
import { Image as UIImage } from "@/components/ui/image";
import { validarSenhaConcluidos, CONCLUIDOS_LABEL } from "@/lib/acessos";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";
const fileName = (url) => (url ? decodeURIComponent(url.split("/").pop() || "arquivo") : "Documento");

export default function EnvelopesAssinados() {
  const { tipo } = useParams();
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState(false);
  const [senha, setSenha] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);

  const [docs, setDocs] = useState([]);
  const [sigs, setSigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Filtros
  const [filtroProc, setFiltroProc] = useState(""); // "" | "processado" | "nao"
  const [filtroGestor, setFiltroGestor] = useState("");
  const [filtroDiretoria, setFiltroDiretoria] = useState("");

  const label = CONCLUIDOS_LABEL[tipo] || "Concluídos";

  const validar = (e) => {
    e.preventDefault();
    if (validarSenhaConcluidos(tipo, senha)) { setUnlocked(true); setSenhaErro(false); }
    else setSenhaErro(true);
  };

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
  useEffect(() => { if (unlocked) load(); }, [unlocked]);

  const mastersFor = (docId) => sigs.filter((s) => s.documento_id === docId && s.etapa === "master" && s.arquivo_url);

  const gestores = useMemo(() => {
    const set = new Set();
    docs.forEach((d) => d.signatario_nome && set.add(d.signatario_nome));
    return Array.from(set);
  }, [docs]);

  const diretorias = useMemo(() => {
    const set = new Set();
    docs.forEach((d) => d.diretoria && set.add(d.diretoria));
    return Array.from(set);
  }, [docs]);

  const docsFiltrados = useMemo(() => docs.filter((d) => {
    if (filtroProc === "processado" && !d.processado) return false;
    if (filtroProc === "nao" && d.processado) return false;
    if (filtroGestor && d.signatario_nome !== filtroGestor) return false;
    if (filtroDiretoria && d.diretoria !== filtroDiretoria) return false;
    return true;
  }), [docs, filtroProc, filtroGestor, filtroDiretoria]);

  // Regra de cor da pasta: vermelho se há a processar, verde se todos processados
  const pendentesProcessar = docs.filter((d) => !d.processado).length;
  const tudoProcessado = docs.length > 0 && pendentesProcessar === 0;
  const corPasta = docs.length === 0 ? "border-border/60" : tudoProcessado ? "border-emerald-500 bg-emerald-50/60" : "border-red-500 bg-red-50/60";

  const baixarUm = async (d) => {
    setDownloadingId(d.id);
    try { await baixarEnvelopePdf(d.id, `${d.numero || "envelope"}.pdf`); }
    catch (e) { toast({ title: "Erro ao baixar", description: e.message, variant: "destructive" }); }
    finally { setDownloadingId(null); }
  };

  const baixarTodos = async () => {
    if (!docsFiltrados.length) return;
    setDownloadingAll(true);
    for (const d of docsFiltrados) {
      try { await baixarEnvelopePdf(d.id, `${d.numero || "envelope"}.pdf`); }
      catch {}
    }
    setDownloadingAll(false);
    toast({ title: "Exportação em massa concluída", description: `${docsFiltrados.length} envelope(s).` });
  };

  const processar = async (d) => {
    setProcessingId(d.id);
    try {
      const agora = new Date().toISOString();
      await base44.entities.Documento.update(d.id, { processado: true, data_processamento: agora });
      setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, processado: true, data_processamento: agora } : x)));
      toast({ title: "Envelope processado", description: "Processamento registrado." });
    } catch (e) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading text-center mb-1">{label}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Informe a senha para acessar os envelopes concluídos.</p>
          <form onSubmit={validar} className="space-y-3">
            <Input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setSenhaErro(false); }} placeholder="Senha" autoFocus />
            {senhaErro && <p className="text-sm text-destructive">Senha incorreta.</p>}
            <Button type="submit" className="w-full gap-2"><ShieldCheck className="w-4 h-4" /> Entrar</Button>
          </form>
          <div className="mt-6 text-center">
            <Button asChild variant="outline" size="sm"><Link to="/">Voltar</Link></Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <UIImage src={LOGO_URL} alt="LOGMAM transportes" className="h-16 w-auto object-contain" />
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-emerald-600 mb-2"><PackageCheck className="w-4 h-4" /> Módulo de envelopes concluídos</div>
            <h1 className="text-3xl font-heading tracking-tight">{label}</h1>
            <p className="text-muted-foreground mt-2">Histórico de envelopes assinados pela diretoria. Exportação individual ou em massa.</p>
          </div>
          <Button type="button" onClick={baixarTodos} disabled={downloadingAll || !docsFiltrados.length} className="gap-2">
            {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar filtrados
          </Button>
        </header>

        {/* Indicador de cor da pasta */}
        <div className={`rounded-xl border-2 px-4 py-3 mb-6 flex items-center gap-3 ${corPasta}`}>
          <FolderOpen className={`w-5 h-5 ${docs.length === 0 ? "text-muted-foreground" : tudoProcessado ? "text-emerald-600" : "text-red-600"}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {docs.length === 0
                ? "Nenhum envelope concluído."
                : tudoProcessado
                  ? `Todos os ${docs.length} envelope(s) processados.`
                  : `${pendentesProcessar} envelope(s) aguardando processamento de ${docs.length} total.`}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${docs.length === 0 ? "bg-slate-100 text-slate-600" : tudoProcessado ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {docs.length === 0 ? "Vazio" : tudoProcessado ? "Verde" : "Vermelho"}
          </span>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Filter className="w-4 h-4" /> Filtros:</div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Processamento</label>
            <select value={filtroProc} onChange={(e) => setFiltroProc(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              <option value="processado">Processado</option>
              <option value="nao">Não processado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Gestor</label>
            <select value={filtroGestor} onChange={(e) => setFiltroGestor(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todos</option>
              {gestores.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Diretoria</label>
            <select value={filtroDiretoria} onChange={(e) => setFiltroDiretoria(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Todas</option>
              {diretorias.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : docsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum envelope com os filtros selecionados.</p>
        ) : (
          <div className="space-y-4">
            {docsFiltrados.map((d) => {
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
                          {d.diretoria && <span>Diretoria: {d.diretoria}</span>}
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