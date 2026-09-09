import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, CheckCircle2, Plus, ScrollText, Users, Paperclip, Download, Loader2, Send, Trash2, Timer, BarChart3, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/signatureUtils";
import { baixarEnvelopePdf } from "@/lib/pdfDownload";
import ShareIcons from "@/components/ShareIcons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Image as UIImage } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/9a85e6240_image.png";

const STAGES = [
  { key: "all", label: "Envelopes", icon: FileText, tone: "text-slate-900" },
  { key: "pendente_gestao", label: "Pendentes gestão", icon: Clock, tone: "text-amber-600" },
  { key: "assinado_gestao", label: "Assinados gestão", icon: CheckCircle2, tone: "text-blue-600" },
  { key: "pendente_diretoria", label: "Pendentes diretoria", icon: Clock, tone: "text-purple-600" },
  { key: "assinado_diretoria", label: "Assinados diretoria", icon: CheckCircle2, tone: "text-emerald-600" },
];

const stageStyles = {
  pendente_gestao: "bg-amber-100 text-amber-700",
  assinado_gestao: "bg-blue-100 text-blue-700",
  pendente_diretoria: "bg-purple-100 text-purple-700",
  assinado_diretoria: "bg-emerald-100 text-emerald-700",
  arquivado: "bg-slate-200 text-slate-500",
};

const stageLabel = {
  pendente_gestao: "Pendente gestão",
  assinado_gestao: "Assinado gestão",
  pendente_diretoria: "Pendente diretoria",
  assinado_diretoria: "Assinado diretoria",
  arquivado: "Arquivado",
};

const fmtDur = (ms) => {
  if (!ms || ms < 0) return "—";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
};

export default function Home() {
  const [documentos, setDocumentos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("all");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroDestinatario, setFiltroDestinatario] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [enviandoId, setEnviandoId] = useState(null);
  const [excluirDoc, setExcluirDoc] = useState(null);
  const [senha, setSenha] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [docs, sigs] = await Promise.all([
        base44.entities.Documento.list("-created_date", 200),
        base44.entities.Assinatura.list("-created_date", 500),
      ]);
      setDocumentos(docs);
      setAssinaturas(sigs);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: documentos.length, pendente_gestao: 0, assinado_gestao: 0, pendente_diretoria: 0, assinado_diretoria: 0 };
    const arqs = { all: 0, pendente_gestao: 0, assinado_gestao: 0, pendente_diretoria: 0, assinado_diretoria: 0 };
    documentos.forEach((d) => {
      const n = d.arquivos?.length || 0;
      arqs.all += n;
      if (c[d.status] !== undefined) { c[d.status]++; arqs[d.status] += n; }
    });
    return { c, arqs };
  }, [documentos]);

  const unidades = useMemo(() => {
    const set = new Set();
    documentos.forEach((d) => d.unidade_negocio && set.add(d.unidade_negocio));
    return Array.from(set);
  }, [documentos]);

  const destinatarios = useMemo(() => {
    const set = new Set();
    documentos.forEach((d) => d.destinatario_nome && set.add(d.destinatario_nome));
    return Array.from(set);
  }, [documentos]);

  const signedCountFor = (docId) => assinaturas.filter((a) => a.documento_id === docId && a.etapa !== "master").length;
  const hasPendente = (d) => signedCountFor(d.id) < (d.arquivos?.length || 0);

  const indicadores = useMemo(() => {
    const docById = {};
    documentos.forEach((d) => { docById[d.id] = d; });
    let totalMs = 0, count = 0;
    const porUnidade = {};
    assinaturas.forEach((a) => {
      const d = docById[a.documento_id];
      if (!d || !a.data_assinatura) return;
      const diff = new Date(a.data_assinatura).getTime() - new Date(d.created_date).getTime();
      if (diff >= 0) {
        totalMs += diff; count++;
        const un = d.unidade_negocio || "Sem unidade";
        if (!porUnidade[un]) porUnidade[un] = { totalMs: 0, count: 0, mesCount: 0 };
        porUnidade[un].totalMs += diff; porUnidade[un].count++;
      }
    });
    const now = new Date();
    documentos.forEach((d) => {
      const cd = new Date(d.created_date);
      if (cd.getMonth() === now.getMonth() && cd.getFullYear() === now.getFullYear()) {
        const un = d.unidade_negocio || "Sem unidade";
        if (!porUnidade[un]) porUnidade[un] = { totalMs: 0, count: 0, mesCount: 0 };
        porUnidade[un].mesCount += (d.arquivos?.length || 0);
      }
    });
    const tempoMedio = count ? totalMs / count : 0;
    let maiorUnidade = "—", maiorTempo = -1;
    Object.entries(porUnidade).forEach(([un, v]) => {
      const med = v.count ? v.totalMs / v.count : 0;
      if (v.count > 0 && med > maiorTempo) { maiorTempo = med; maiorUnidade = un; }
    });
    const unidadesMes = Object.entries(porUnidade).filter(([, v]) => v.mesCount > 0).sort((a, b) => b[1].mesCount - a[1].mesCount);
    return { tempoMedio, maiorUnidade, maiorTempo, unidadesMes };
  }, [documentos, assinaturas]);

  const docsFiltrados = documentos.filter((d) => {
    if (stage !== "all" && d.status !== stage) return false;
    if (filtroUnidade && d.unidade_negocio !== filtroUnidade) return false;
    if (filtroData && d.data_limite !== filtroData) return false;
    if (filtroDestinatario && d.destinatario_nome !== filtroDestinatario) return false;
    return true;
  });

  const baixar = async (d) => {
    setDownloadingId(d.id);
    try { await baixarEnvelopePdf(d.id, `${d.numero || "envelope"}.pdf`); }
    catch {} finally { setDownloadingId(null); }
  };

  const enviarDiretoria = async (d) => {
    setEnviandoId(d.id);
    try {
      await base44.entities.Documento.update(d.id, { status: "pendente_diretoria" });
      await load();
    } catch {} finally { setEnviandoId(null); }
  };

  const linkPara = (d) => (d.status === "pendente_diretoria" || d.status === "assinado_diretoria" ? `/assinar-diretoria/${d.id}` : `/assinar/${d.id}`);

  const confirmarExclusao = async () => {
    if (senha !== "062026") { toast({ title: "Senha incorreta", variant: "destructive" }); return; }
    setExcluindo(true);
    try {
      await base44.entities.Assinatura.deleteMany({ documento_id: excluirDoc.id });
      await base44.entities.Documento.delete(excluirDoc.id);
      setExcluirDoc(null);
      setSenha("");
      await load();
      toast({ title: "Envelope excluído" });
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
    finally { setExcluindo(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <UIImage src={LOGO_URL} alt="LOGMAM transportes" className="h-20 w-auto object-contain" />
        </div>
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <span className="text-sm font-medium text-brand mb-2 inline-block">Assinatura Fácil Log</span>
            <h1 className="text-4xl font-heading tracking-tight text-foreground">Painel</h1>
            <p className="text-muted-foreground mt-2">Pipeline de assinaturas: gestão → diretoria.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/cadastros" className="gap-2"><Users className="w-4 h-4" /> Cadastros</Link></Button>
            <Button asChild variant="outline"><Link to="/log" className="gap-2"><ScrollText className="w-4 h-4" /> Log</Link></Button>
            <Button asChild><Link to="/novo" className="gap-2"><Plus className="w-4 h-4" /> Novo envelope</Link></Button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {STAGES.map((s, i) => (
            <motion.button key={s.key} type="button" onClick={() => setStage(s.key)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`text-left rounded-2xl border shadow-sm transition-all ${stage === s.key ? "border-foreground/30 ring-1 ring-foreground/20" : "border-border/60 hover:border-foreground/20"}`}>
              <Card className="rounded-2xl border-0 shadow-none bg-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <s.icon className={`w-4 h-4 ${s.tone}`} />
                  </div>
                  <p className="text-2xl font-heading mt-2">{loading ? "—" : counts.c[s.key]}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {counts.arqs[s.key]} arquivos</p>
                </CardContent>
              </Card>
            </motion.button>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Painel vertical de indicadores */}
          <aside className="lg:col-span-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-1"><BarChart3 className="w-4 h-4" /> Indicadores</div>
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Timer className="w-3.5 h-3.5" /> Tempo médio criação → assinatura</div>
                <p className="text-2xl font-heading text-foreground">{loading ? "—" : fmtDur(indicadores.tempoMedio)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Paperclip className="w-3.5 h-3.5" /> NFs este mês por unidade</div>
                {indicadores.unidadesMes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma NF no mês.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {indicadores.unidadesMes.map(([un, v]) => (
                      <li key={un} className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground">{un}</span>
                        <span className="font-medium tabular-nums">{v.mesCount}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="w-3.5 h-3.5" /> Unidade com maior tempo para assinar</div>
                <p className="text-lg font-heading text-foreground truncate">{indicadores.maiorUnidade}</p>
                <p className="text-sm text-muted-foreground tabular-nums">{fmtDur(indicadores.maiorTempo)}</p>
              </CardContent>
            </Card>
          </aside>

          {/* Conteúdo principal */}
          <div className="lg:col-span-9 space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Unidade de negócio</label>
                <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Todas</option>
                  {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Destinatário</label>
                <select value={filtroDestinatario} onChange={(e) => setFiltroDestinatario(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Todos</option>
                  {destinatarios.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Data limite</label>
                <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : docsFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum envelope nesta etapa.</p>
              ) : (
                docsFiltrados.map((d) => {
                  const signed = signedCountFor(d.id);
                  const total = d.arquivos?.length || 0;
                  const pendente = hasPendente(d);
                  return (
                    <Card key={d.id} className={`rounded-xl transition-all hover:shadow-md ${pendente ? "border-red-400 bg-red-50/40 hover:border-red-500" : "border-border/60 hover:border-foreground/20"}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <Link to={linkPara(d)} className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {d.numero && <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{d.numero}</span>}
                            <p className="font-medium truncate">{d.titulo}</p>
                            {pendente && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Arquivo pendente</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> {signed}/{total} assinadas</span>
                            {d.destinatario_nome && <span>Dest.: {d.destinatario_nome}</span>}
                            {d.signatario_nome && <span>Gestão: {d.signatario_nome}</span>}
                            {d.unidade_negocio && <span>UN: {d.unidade_negocio}</span>}
                            {d.data_limite && <span>{formatDate(d.data_limite)}</span>}
                          </p>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.status === "assinado_gestao" && (
                            <button type="button" onClick={() => enviarDiretoria(d)} disabled={enviandoId === d.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50" title="Enviar para assinatura da diretoria">
                              {enviandoId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar à diretoria
                            </button>
                          )}
                          {d.status !== "pendente_gestao" && (
                            <button type="button" onClick={() => baixar(d)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Baixar envelope (PDF)">
                              {downloadingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            </button>
                          )}
                          <button type="button" onClick={() => { setExcluirDoc(d); setSenha(""); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive" title="Excluir envelope">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ShareIcons title={d.titulo} signUrl={`${window.location.origin}${linkPara(d)}`} />
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stageStyles[d.status] || "bg-slate-100 text-slate-600"}`}>{stageLabel[d.status] || d.status}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>

      <Dialog open={!!excluirDoc} onOpenChange={(o) => !o && setExcluirDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir envelope</DialogTitle>
            <DialogDescription>Informe a senha para confirmar a exclusão de "{excluirDoc?.titulo}". Esta ação remove o envelope e suas assinaturas.</DialogDescription>
          </DialogHeader>
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" autoFocus onKeyDown={(e) => { if (e.key === "Enter") confirmarExclusao(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirDoc(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={excluindo || !senha} onClick={confirmarExclusao} className="gap-2">
              {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}