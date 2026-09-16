import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, CheckCircle2, Plus, ScrollText, Users, Paperclip, Loader2, Trash2, Timer, BarChart3, Ban } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/signatureUtils";
import { baixarEnvelopePdf } from "@/lib/pdfDownload";
import { podeVerPainel, podeCriarEnvelope, podeExcluirEnvelope, podeAcessarConcluidos, podeVerCadastros, podeVerLog, stagesPermitidos, filtrarEnvelopesVisiveis } from "@/lib/permissoes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Image as UIImage } from "@/components/ui/image";
import EnvelopeCard from "@/components/EnvelopeCard";
import DiretoriaFolders from "@/components/DiretoriaFolders";
import DiretoriaBanner from "@/components/DiretoriaBanner";
import GestorBanner from "@/components/GestorBanner";
import PastaRecusados from "@/components/PastaRecusados";
import ColunasCategorias from "@/components/ColunasCategorias";
import { stageStyles, stageLabel } from "@/lib/stageStyles";

const LOGO_URL = "https://media.base44.com/images/public/6aa074a5ce060f1b2caeee8f/86ee25d0d_image.png";

const STAGES = [
  { key: "all", label: "Envelopes", icon: FileText, tone: "text-slate-900" },
  { key: "pendente_gestao", label: "Pendentes gestão", icon: Clock, tone: "text-amber-600" },
  { key: "assinado_gestao", label: "Assinados gestão", icon: CheckCircle2, tone: "text-blue-600" },
  { key: "pendente_diretoria", label: "Pendentes diretoria", icon: Clock, tone: "text-purple-600" },
  { key: "recusados", label: "Parc. recusados", icon: Ban, tone: "text-amber-600" },
];

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
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [arquivosRecusados, setArquivosRecusados] = useState([]);
  const [cadastros, setCadastros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("all");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroDestinatario, setFiltroDestinatario] = useState("");
  const [filtroDiretoria, setFiltroDiretoria] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [enviandoId, setEnviandoId] = useState(null);
  const [excluirDoc, setExcluirDoc] = useState(null);
  const [senha, setSenha] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [docs, sigs, recus, cad] = await Promise.all([
        base44.entities.Documento.list("-created_date", 200),
        base44.entities.Assinatura.list("-created_date", 500),
        base44.entities.ArquivoRecusado.list("-created_date", 500),
        base44.entities.Cadastro.list("-created_date", 200),
      ]);
      setDocumentos(docs);
      setAssinaturas(sigs);
      setArquivosRecusados(recus);
      setCadastros(cad);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const documentosVisiveis = useMemo(() => filtrarEnvelopesVisiveis(user, documentos, cadastros), [user, documentos, cadastros]);
  const stagesVisiveis = useMemo(() => STAGES.filter((s) => stagesPermitidos(user).includes(s.key)), [user]);

  useEffect(() => {
    const permitidos = stagesPermitidos(user);
    if (permitidos.length && !permitidos.includes(stage)) setStage(permitidos[0]);
  }, [user]);

  const counts = useMemo(() => {
    const c = { all: 0, pendente_gestao: 0, assinado_gestao: 0, pendente_diretoria: 0, recusados: 0 };
    const arqs = { all: 0, pendente_gestao: 0, assinado_gestao: 0, pendente_diretoria: 0, recusados: 0 };
    documentosVisiveis.forEach((d) => {
      if (d.status === "assinado_diretoria") return;
      const n = d.arquivos?.length || 0;
      arqs.all += n; c.all++;
      if (c[d.status] !== undefined) { c[d.status]++; arqs[d.status] += n; }
    });
    const recusadoDocIds = new Set(arquivosRecusados.map((r) => r.documento_id));
    c.recusados = recusadoDocIds.size;
    arqs.recusados = arquivosRecusados.length;
    return { c, arqs };
  }, [documentosVisiveis, arquivosRecusados]);

  const unidades = useMemo(() => {
    const set = new Set();
    documentosVisiveis.forEach((d) => d.unidade_negocio && set.add(d.unidade_negocio));
    return Array.from(set);
  }, [documentosVisiveis]);

  const destinatarios = useMemo(() => {
    const set = new Set();
    documentosVisiveis.forEach((d) => d.destinatario_nome && set.add(d.destinatario_nome));
    return Array.from(set);
  }, [documentosVisiveis]);

  const diretorias = useMemo(() => {
    const set = new Set();
    documentosVisiveis.forEach((d) => d.diretoria && set.add(d.diretoria));
    return Array.from(set);
  }, [documentosVisiveis]);

  const signedCountFor = (docId) => assinaturas.filter((a) => a.documento_id === docId && a.etapa !== "master").length;
  const hasPendente = (d) => signedCountFor(d.id) < (d.arquivos?.length || 0);

  const indicadores = useMemo(() => {
    const docById = {};
    documentosVisiveis.forEach((d) => { docById[d.id] = d; });
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
    documentosVisiveis.forEach((d) => {
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
  }, [documentosVisiveis, assinaturas]);

  const recusadoDocIds = useMemo(() => new Set(arquivosRecusados.map((r) => r.documento_id)), [arquivosRecusados]);

  const docsFiltrados = documentosVisiveis.filter((d) => {
    if (stage === "recusados") return recusadoDocIds.has(d.id);
    if (d.status === "assinado_diretoria") return false;
    if (stage !== "all" && d.status !== stage) return false;
    if (filtroUnidade && d.unidade_negocio !== filtroUnidade) return false;
    if (filtroData && d.data_limite !== filtroData) return false;
    if (filtroDestinatario && d.destinatario_nome !== filtroDestinatario) return false;
    if (stage === "pendente_diretoria" && filtroDiretoria && d.diretoria !== filtroDiretoria) return false;
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

  const linkPara = (d) => {
    if (hasPendente(d)) return `/assinar/${d.id}`;
    if (d.status === "pendente_diretoria" || d.status === "assinado_diretoria") return `/assinar-diretoria/${d.id}`;
    return `/assinar/${d.id}`;
  };

  const excluirHandler = podeExcluirEnvelope(user) ? (doc) => { setExcluirDoc(doc); setSenha(""); } : undefined;

  const confirmarExclusao = async () => {
    if (senha !== "LOG@2026") { toast({ title: "Senha incorreta", variant: "destructive" }); return; }
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
            {podeVerCadastros(user) && <Button asChild variant="outline"><Link to="/cadastros" className="gap-2"><Users className="w-4 h-4" /> Cadastros</Link></Button>}
            {podeVerLog(user) && <Button asChild variant="outline"><Link to="/log" className="gap-2"><ScrollText className="w-4 h-4" /> Log</Link></Button>}
            <Button asChild variant="outline"><Link to="/relatorios" className="gap-2"><BarChart3 className="w-4 h-4" /> Relatórios</Link></Button>
            {podeAcessarConcluidos(user, "financeiro") && <Button asChild variant="outline"><Link to="/concluidos/financeiro" className="gap-2"><CheckCircle2 className="w-4 h-4" /> Concl. Financeiro</Link></Button>}
            {podeAcessarConcluidos(user, "fiscal") && <Button asChild variant="outline"><Link to="/concluidos/fiscal" className="gap-2"><CheckCircle2 className="w-4 h-4" /> Concl. Fiscal</Link></Button>}
            {podeAcessarConcluidos(user, "abastecimento") && <Button asChild variant="outline"><Link to="/concluidos/abastecimento" className="gap-2"><CheckCircle2 className="w-4 h-4" /> Concl. Abastecimento</Link></Button>}
            {podeCriarEnvelope(user) && <Button asChild><Link to="/novo" className="gap-2"><Plus className="w-4 h-4" /> Novo envelope</Link></Button>}
          </div>
        </header>

        {podeVerPainel(user) && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {stagesVisiveis.map((s, i) => (
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
        )}

        {podeVerPainel(user) ? (
          <div className="space-y-6">
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
              {stage === "pendente_diretoria" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Diretoria</label>
                  <select value={filtroDiretoria} onChange={(e) => setFiltroDiretoria(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Todas</option>
                    {diretorias.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : stage === "recusados" ? (
              <PastaRecusados
                recusados={arquivosRecusados.filter((r) => docsFiltrados.some((d) => d.id === r.documento_id))}
                documentos={docsFiltrados}
                linkPara={linkPara}
                onExcluir={excluirHandler}
                onRecuperou={load}
              />
            ) : (
              <ColunasCategorias
                documentos={docsFiltrados}
                signedCountFor={signedCountFor}
                hasPendente={hasPendente}
                linkPara={linkPara}
                onEnviarDiretoria={enviarDiretoria}
                onBaixar={baixar}
                onExcluir={excluirHandler}
                enviandoId={enviandoId}
                downloadingId={downloadingId}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Selecione uma das pastas de concluídos no topo para gerenciar as atividades.</p>
          </div>
        )}

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